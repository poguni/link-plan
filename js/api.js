// 데이터 어댑터. 화면 코드는 이 파일의 함수만 부릅니다(Phase 2~3 의 샘플 어댑터를 Supabase 어댑터로 바꿔 끼웠습니다).

// Supabase 클라이언트(PRD 5-2, index.html 이 CDN 스크립트로 window.supabase 를 미리 준비해 둡니다).
// auth.js 가 이 클라이언트로 로그인·가입·세션을 다룹니다. anon key 는 공개돼도 되지만 RLS 가 전제입니다(CLAUDE.md 보안 규칙).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
const { createClient } = window.supabase;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Postgres 오류를 사람이 읽을 문장으로 바꿉니다. check_plan_parent() 같은 트리거는 이미 한국어로
// raise exception 하므로(P0001) 그대로 보여 주고, 나머지 흔한 제약 위반만 몇 가지 안내로 바꿉니다.
function friendlyDbError(error) {
  if (error?.code === 'P0001') return error.message;
  if (error?.code === '23502') return '필수 항목이 비어 있어요.';
  if (error?.code === '23514') return '입력값이 규칙에 맞지 않아요(제목은 1~100자, 종료일은 시작일 이후).';
  if (error?.code === '23503') return '연결하려는 항목을 찾을 수 없어요. 새로고침 후 다시 시도해 주세요.';
  if (error?.code === '42501') return '권한이 없어요. 로그인 상태를 확인해 주세요.';
  return '저장하지 못했어요. 잠시 후 다시 시도해 주세요.';
}
function dbThrow(error) { console.error(error); throw new Error(friendlyDbError(error)); }

// ── 전체 불러오기 ───────────────────────────────────
export async function loadAll() {
  const [plansRes, tasksRes, linksRes] = await Promise.all([
    supabase.from('plans').select('id, plan_type, title, period_start, period_end, parent_id, sort_order').order('sort_order'),
    supabase.from('tasks').select('id, title, memo, due_date, status, completed_at, sort_order, is_favorite').order('sort_order'),
    supabase.from('task_plan_links').select('task_id, plan_id'),
  ]);
  if (plansRes.error) dbThrow(plansRes.error);
  if (tasksRes.error) dbThrow(tasksRes.error);
  if (linksRes.error) dbThrow(linksRes.error);
  return { plans: plansRes.data, tasks: tasksRes.data, links: linksRes.data };
}

// 진행률은 서버의 plan_progress 뷰 결과를 씁니다(PRD: 화면 표시는 서버 값 기준, 드래그 직후 미리보기만 로컬 계산).
export async function getProgress(planIds) {
  if (!planIds.length) return {};
  const { data, error } = await supabase.from('plan_progress').select('plan_id, total_tasks, done_tasks').in('plan_id', planIds);
  if (error) dbThrow(error);
  const map = {};
  data.forEach((row) => {
    map[row.plan_id] = { total: row.total_tasks, done: row.done_tasks, pct: row.total_tasks === 0 ? null : Math.round((row.done_tasks / row.total_tasks) * 100) };
  });
  return map;
}

// ── 할 일 CRUD(P0-1, P0-2) ──────────────────────────
export async function createTask({ title, memo, due_date, is_favorite = false }) {
  const { data, error } = await supabase.from('tasks').insert({ title, memo: memo || null, due_date: due_date || null, is_favorite })
    .select('id, title, memo, due_date, status, completed_at, sort_order, is_favorite').single();
  if (error) dbThrow(error);
  return data;
}

export async function updateTask(taskId, patch) {
  const { error } = await supabase.from('tasks').update(patch).eq('id', taskId);
  if (error) dbThrow(error);
}

export async function deleteTask(taskId) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) dbThrow(error);
}

// completed_at 은 서버 트리거(tasks_set_completed_at)가 항상 다시 계산하므로, 세 번째 인자는 화면의
// 낙관적 표시용일 뿐 서버에는 보내지 않습니다(01_schema.sql 6-1).
export async function updateTaskStatus(taskId, status) {
  const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId);
  if (error) dbThrow(error);
}

// ── 계획 CRUD(P0-5, P0-6) ───────────────────────────
export async function createPlan({ plan_type, title, period_start, period_end, parent_id }) {
  const { data, error } = await supabase.from('plans').insert({ plan_type, title, period_start, period_end, parent_id: parent_id || null })
    .select('id, plan_type, title, period_start, period_end, parent_id, sort_order').single();
  if (error) dbThrow(error);
  return data;
}

export async function updatePlan(planId, patch) {
  const { error } = await supabase.from('plans').update(patch).eq('id', planId);
  if (error) dbThrow(error);
}

// 계획을 지워도 연결된 할 일과 하위 계획은 남습니다. 하위 계획의 parent_id 는 서버가 비우고
// (on delete set null), 연결 행(task_plan_links)만 함께 지워집니다(01_schema.sql, PRD P0-5).
export async function deletePlan(planId) {
  const { error } = await supabase.from('plans').delete().eq('id', planId);
  if (error) dbThrow(error);
}

// ── 할 일-계획 연결(P0-7) ───────────────────────────
export async function addLink(taskId, planId) {
  const { error } = await supabase.from('task_plan_links').insert({ task_id: taskId, plan_id: planId });
  if (error) dbThrow(error);
}
export async function removeLink(taskId, planId) {
  const { error } = await supabase.from('task_plan_links').delete().eq('task_id', taskId).eq('plan_id', planId);
  if (error) dbThrow(error);
}

// ── 뷰·테마 설정(PRD 6-8, P1-10 을 앞당겨 지금 씀) ──
// user_settings.user_id 는 서버 기본값(auth.uid())에 맡기고 클라이언트가 임의로 넣지 않습니다(RLS 확인).
export async function getSettings() {
  const { data, error } = await supabase.from('user_settings').select('theme, view_mode').maybeSingle();
  if (error) dbThrow(error);
  return data; // 첫 로그인이면 아직 행이 없어 null 입니다.
}
export async function saveSettings({ theme, view_mode }) {
  const { error } = await supabase.from('user_settings')
    .upsert({ theme, view_mode, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) console.error('설정을 저장하지 못했어요.', error); // 화면 전환을 막을 만큼 중요하지 않아 조용히만 기록합니다.
}
