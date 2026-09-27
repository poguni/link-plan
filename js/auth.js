// 로그인·가입·세션·승인 여부를 다루는 인증 모듈입니다(PRD P0-14~P0-17, 3-4, 6-10).
// 화면(js/authview.js)은 이 파일의 함수만 부릅니다.
import { supabase } from './api.js';

// 비밀번호 규칙: 영문과 숫자를 각각 1자 이상 포함, 8자 이상(PRD P0-14).
// 여기서는 화면이 먼저 알려 주기 위한 검사이고, 최종 기준은 Supabase Auth 의 서버 쪽 비밀번호 정책입니다.
export function checkPassword(pw) {
  return { length: pw.length >= 8, letter: /[A-Za-z]/.test(pw), digit: /[0-9]/.test(pw) };
}
export function passwordOk(pw) {
  const c = checkPassword(pw);
  return c.length && c.letter && c.digit;
}

// Supabase 오류 메시지를 감정 없이 구체적인 한국어 안내로 바꿉니다(PRD 10절, P0-15).
function friendlyAuthError(err) {
  const msg = String(err?.message || '');
  if (err?.status === 429 || /rate limit|too many/i.test(msg)) return '요청이 많아요. 잠시 후 다시 시도해 주세요.';
  if (/invalid login credentials/i.test(msg)) return '이메일 또는 비밀번호가 맞지 않아요.';
  if (/already registered|already exists/i.test(msg)) return '이미 가입된 이메일이에요.';
  if (/password/i.test(msg)) return '비밀번호가 규칙에 맞지 않아요(영문+숫자 8자 이상).';
  if (/email/i.test(msg)) return '이메일 형식을 확인해 주세요.';
  return msg || '알 수 없는 오류가 발생했어요.';
}

export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(friendlyAuthError(error));
  // 가입 직후 세션이 생기더라도 승인 전이므로 로그인 화면으로 보냅니다(DESIGN.md 3-4).
  await supabase.auth.signOut();
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendlyAuthError(error));
}

export async function signOut() {
  await supabase.auth.signOut();
}

// 새 비밀번호와 함께 must_change_password 를 끕니다. 이 값은 사용자가 스스로 바꿀 수 있어 보안 경계가 아니고,
// 임시 비밀번호를 그대로 쓰지 않게 하는 화면 규칙일 뿐입니다(PRD 5-7). RLS·관리자 API 는 이 값을 믿지 않습니다.
export async function changePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword, data: { must_change_password: false } });
  if (error) throw new Error(friendlyAuthError(error));
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// 로그인·로그아웃·토큰 갱신 등 인증 상태가 바뀔 때마다 콜백을 부릅니다. 구독 해지 함수를 돌려줍니다.
export function onAuthChange(cb) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

// profiles 테이블에서 승인·관리자 여부를 읽습니다. RLS 로 자기 행만 보이고, 승인 전에도 이 조회는 허용됩니다(supabase/02_rls.sql).
export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('approved, is_admin').eq('id', userId).single();
  if (error) throw error;
  return data;
}

// 관리자가 비밀번호를 초기화한 계정 표시(auth.users.user_metadata, PRD 5-7).
export function mustChangePassword(session) {
  return Boolean(session?.user?.user_metadata?.must_change_password);
}
