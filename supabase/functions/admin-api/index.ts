// 관리자 전용 Edge Function(PRD 5-7). service_role 키가 필요한 작업(계정 삭제·비밀번호 변경)을
// 여기서만 수행합니다. 브라우저·저장소에는 service_role 키를 절대 두지 않습니다(CLAUDE.md 보안 규칙).
//
// 흐름: 관리자 페이지(admin.html) -> 로그인 토큰 + action -> 이 함수 -> 호출자가 관리자인지
// 서버에서 다시 확인(RLS 예외를 안 만들기 위함) -> service_role 로 Auth Admin API·DB 호출.
//
// 무료 플랜 한도(메모리 256MB, CPU 2초, 벽시계 150초)를 고려해, 모든 작업은 사용자 1명 단위로만
// 처리합니다(list_users 도 프로젝트 규모상 전체를 한 번에 반환해도 안전한 크기로 가정합니다).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// 링크 플랜 주소만 허용합니다. 대시보드/CLI 로 시크릿을 설정해야 브라우저에서 이 함수를 부를 수 있습니다.
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "";

const ACTIONS = [
  "list_users",
  "set_approved",
  "delete_user",
  "reset_password",
  "export_user",
  "delete_user_data",
] as const;
type Action = (typeof ACTIONS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

// ── 각 작업 ───────────────────────────────────────
async function listUsers(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, approved, is_admin, created_at, approved_at")
    .order("created_at");
  if (error) throw new Error("사용자 목록을 불러오지 못했어요.");
  return { users: data };
}

async function setApproved(admin: SupabaseClient, userId: string, approved: unknown) {
  if (typeof approved !== "boolean") throw new Error("승인 값이 올바르지 않아요.");
  const { data: target, error: findErr } = await admin
    .from("profiles").select("is_admin").eq("id", userId).single();
  if (findErr || !target) throw new Error("대상 사용자를 찾을 수 없어요.");
  if (target.is_admin && !approved) throw new Error("관리자 계정의 승인은 취소할 수 없어요.");
  const { error } = await admin.from("profiles")
    .update({ approved, approved_at: approved ? new Date().toISOString() : null })
    .eq("id", userId);
  if (error) throw new Error("승인 상태를 바꾸지 못했어요.");
  return { ok: true };
}

async function deleteUser(admin: SupabaseClient, callerId: string, userId: string, confirmEmail: unknown) {
  if (userId === callerId) throw new Error("자기 자신은 삭제할 수 없어요.");
  const { data: target, error: findErr } = await admin
    .from("profiles").select("email, is_admin").eq("id", userId).single();
  if (findErr || !target) throw new Error("대상 사용자를 찾을 수 없어요.");
  if (target.is_admin) throw new Error("관리자 계정은 삭제할 수 없어요.");
  if (confirmEmail !== target.email) throw new Error("확인 이메일이 일치하지 않아요.");
  // auth.users 삭제가 profiles·plans·tasks·task_plan_links·user_settings 를 on delete cascade 로 함께 지웁니다.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error("사용자를 삭제하지 못했어요.");
  return { ok: true };
}

function randomTempPassword() {
  // 영문·숫자 12자, 각각 1자 이상 포함(PRD 5-7). 헷갈리는 문자(0/O, 1/l 등)는 뺐습니다.
  const letters = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const chars = [letters, digits].map((set) => set[Math.floor(Math.random() * set.length)]);
  for (let i = chars.length; i < 12; i++) chars.push(all[Math.floor(Math.random() * all.length)]);
  return chars.sort(() => Math.random() - 0.5).join("");
}

async function resetPassword(admin: SupabaseClient, callerId: string, userId: string) {
  if (userId === callerId) throw new Error("자기 자신의 비밀번호는 「내 계정」 메뉴에서 바꿔 주세요.");
  const { data: existing, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !existing?.user) throw new Error("대상 사용자를 찾을 수 없어요.");
  const tempPassword = randomTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: tempPassword,
    user_metadata: { ...existing.user.user_metadata, must_change_password: true },
  });
  if (error) throw new Error("비밀번호를 초기화하지 못했어요.");
  // 임시 비밀번호는 이 응답에만 담고, 서버 어디에도 기록하지 않습니다(PRD P0-21).
  return { temp_password: tempPassword };
}

async function exportUser(admin: SupabaseClient, userId: string) {
  const { data: profile, error: pErr } = await admin
    .from("profiles").select("id, email, approved, created_at, approved_at").eq("id", userId).single();
  if (pErr || !profile) throw new Error("대상 사용자를 찾을 수 없어요.");
  const [settingsRes, plansRes, tasksRes, linksRes] = await Promise.all([
    admin.from("user_settings").select("theme, view_mode").eq("user_id", userId).maybeSingle(),
    admin.from("plans").select("id, plan_type, title, period_start, period_end, parent_id, created_at").eq("user_id", userId).order("created_at"),
    admin.from("tasks").select("id, title, memo, due_date, status, completed_at, created_at").eq("user_id", userId).order("created_at"),
    admin.from("task_plan_links").select("task_id, plan_id").eq("user_id", userId),
  ]);
  return {
    format: "linkplan-export",
    version: 1,
    exported_at: new Date().toISOString(),
    profile,
    settings: settingsRes.data ?? null,
    plans: plansRes.data ?? [],
    tasks: tasksRes.data ?? [],
    task_plan_links: linksRes.data ?? [],
  };
}

async function deleteUserData(admin: SupabaseClient, userId: string, confirmEmail: unknown) {
  const { data: target, error: findErr } = await admin
    .from("profiles").select("email").eq("id", userId).single();
  if (findErr || !target) throw new Error("대상 사용자를 찾을 수 없어요.");
  if (confirmEmail !== target.email) throw new Error("확인 이메일이 일치하지 않아요.");
  // task_plan_links 는 tasks·plans 의 on delete cascade 로 함께 지워집니다. 순서는 상관없고,
  // 이미 지워진 뒤 다시 실행해도 0행 삭제로 끝나 결과가 같습니다(PRD P0-23, 재실행 안전).
  const [tasksRes, plansRes, settingsRes] = await Promise.all([
    admin.from("tasks").delete().eq("user_id", userId),
    admin.from("plans").delete().eq("user_id", userId),
    admin.from("user_settings").delete().eq("user_id", userId),
  ]);
  if (tasksRes.error || plansRes.error || settingsRes.error) throw new Error("데이터를 지우지 못했어요.");
  return { ok: true };
}

// ── 진입점 ────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });
  if (req.method !== "POST") return json({ error: "허용되지 않는 요청이에요." }, 405);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "로그인이 필요해요." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // 1) 호출자 신원 확인(토큰이 유효한 로그인 사용자의 것인지).
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "로그인이 필요해요." }, 401);
  const caller = userData.user;

  // 2) 호출자가 승인된 관리자인지 서버에서 다시 확인(화면 상태를 믿지 않음, PRD 5-7 공통 규칙 2).
  const { data: callerProfile } = await admin
    .from("profiles").select("approved, is_admin").eq("id", caller.id).single();
  if (!callerProfile?.approved || !callerProfile?.is_admin) {
    return json({ error: "관리자만 할 수 있어요." }, 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "요청 형식이 올바르지 않아요." }, 400);
  }

  const action = body.action as Action;
  const userId = body.user_id as string;
  if (!ACTIONS.includes(action)) return json({ error: "알 수 없는 작업이에요." }, 400);
  if (action !== "list_users" && !UUID_RE.test(userId ?? "")) {
    return json({ error: "대상 사용자를 확인할 수 없어요." }, 400);
  }

  try {
    switch (action) {
      case "list_users":
        return json(await listUsers(admin));
      case "set_approved":
        return json(await setApproved(admin, userId, body.approved));
      case "delete_user":
        return json(await deleteUser(admin, caller.id, userId, body.confirm_email));
      case "reset_password":
        return json(await resetPassword(admin, caller.id, userId));
      case "export_user":
        return json(await exportUser(admin, userId));
      case "delete_user_data":
        return json(await deleteUserData(admin, userId, body.confirm_email));
    }
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "처리하지 못했어요." }, 400);
  }
});
