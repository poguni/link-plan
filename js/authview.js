// 인증 화면(로그인·가입·승인 대기·비밀번호 변경)과 화면 전환을 맡습니다(PRD P0-14~P0-17, 3-4, DESIGN.md 10절).
// 승인 후에는 기존 셸(js/shell.js)·보드/링크 뷰를 그대로 불러와 앱을 보여 줍니다.
import { icon } from './icons.js';
import { showToast } from './ui.js';
import {
  signIn, signUp, signOut, changePassword,
  getSession, onAuthChange, getProfile, mustChangePassword, passwordOk,
} from './auth.js';
import { loadState } from './state.js';
import { renderShell, bindShell, setUser } from './shell.js';
import { mountBoard } from './board.js';
import { mountLink } from './link.js';
import { getSettings } from './api.js';
import { setTheme, setView } from './theme.js';

const root = () => document.getElementById('app');

let session = null;
let profile = null;
let appMounted = false;

// ── 작은 도우미(로그인·가입·비밀번호 변경 화면이 함께 씁니다) ──
function brandHtml() {
  return `<div class="auth-brand">
    <div class="logo-mark">${icon('link', 22)}</div>
    <div class="auth-brand-name">링크 플랜</div>
  </div>`;
}

function ruleHtml(pw) {
  const ok = passwordOk(pw);
  return `<div class="field-rule${ok ? ' is-ok' : ''}">${icon(ok ? 'circle-check' : 'triangle-alert', 14)}<span>영문+숫자 8자 이상</span></div>`;
}

function fieldHtml({ id, label, type = 'text', autocomplete, withRule = false }) {
  const isPassword = type === 'password';
  return `<div class="field">
    <label class="field-label" for="${id}">${label}</label>
    <div class="field-input-wrap">
      <input class="field-input${isPassword ? ' has-toggle' : ''}" id="${id}" name="${id}" type="${type}" autocomplete="${autocomplete || ''}" required>
      ${isPassword ? `<button type="button" class="field-toggle" data-pw-toggle aria-label="비밀번호 표시">${icon('eye', 18)}</button>` : ''}
    </div>
    ${withRule ? `<div id="${id}-rule">${ruleHtml('')}</div>` : ''}
  </div>`;
}

function togglePw(btn) {
  const input = btn.previousElementSibling;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.innerHTML = icon(show ? 'eye-off' : 'eye', 18);
  btn.setAttribute('aria-label', show ? '비밀번호 숨기기' : '비밀번호 표시');
}

function bindPwToggles(scope = document) {
  scope.querySelectorAll('[data-pw-toggle]').forEach((btn) => btn.addEventListener('click', () => togglePw(btn)));
}
function bindRuleLive(id, scope = document) {
  const input = scope.querySelector(`#${id}`);
  const ruleBox = scope.querySelector(`#${id}-rule`);
  if (!input || !ruleBox) return;
  input.addEventListener('input', () => { ruleBox.innerHTML = ruleHtml(input.value); });
}
function setError(id, message, scope = document) {
  const box = scope.querySelector(`#${id}`);
  box.hidden = !message;
  box.querySelector('span').textContent = message || '';
}

// ── 로그인·가입 카드 ─────────────────────────────
function renderAuthCard(defaultTab = 'login') {
  appMounted = false;
  root().innerHTML = `<div class="auth-shell"><div class="auth-card">
    ${brandHtml()}
    <div class="auth-tabs" role="tablist" aria-label="로그인 또는 가입">
      <button type="button" class="auth-tab" role="tab" data-tab="login" aria-selected="${defaultTab === 'login'}">로그인</button>
      <button type="button" class="auth-tab" role="tab" data-tab="signup" aria-selected="${defaultTab === 'signup'}">가입</button>
    </div>

    <form class="auth-form" id="login-form" novalidate ${defaultTab === 'login' ? '' : 'hidden'}>
      ${fieldHtml({ id: 'login-email', label: '이메일', type: 'email', autocomplete: 'email' })}
      ${fieldHtml({ id: 'login-password', label: '비밀번호', type: 'password', autocomplete: 'current-password' })}
      <div class="field-error" id="login-error" hidden>${icon('triangle-alert', 15)}<span></span></div>
      <div class="auth-actions"><button type="submit" class="btn btn-primary">로그인</button></div>
    </form>

    <form class="auth-form" id="signup-form" novalidate ${defaultTab === 'signup' ? '' : 'hidden'}>
      ${fieldHtml({ id: 'signup-email', label: '이메일', type: 'email', autocomplete: 'email' })}
      ${fieldHtml({ id: 'signup-password', label: '비밀번호', type: 'password', autocomplete: 'new-password', withRule: true })}
      ${fieldHtml({ id: 'signup-password-confirm', label: '비밀번호 확인', type: 'password', autocomplete: 'new-password' })}
      <div class="field-error" id="signup-error" hidden>${icon('triangle-alert', 15)}<span></span></div>
      <div class="auth-actions"><button type="submit" class="btn btn-primary">가입하기</button></div>
    </form>
  </div></div>`;

  document.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  bindPwToggles();
  bindRuleLive('signup-password');
  document.getElementById('login-form').addEventListener('submit', onLoginSubmit);
  document.getElementById('signup-form').addEventListener('submit', onSignupSubmit);
}

function switchTab(tab) {
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  document.getElementById('login-form').hidden = tab !== 'login';
  document.getElementById('signup-form').hidden = tab !== 'signup';
}

async function onLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  setError('login-error', '');
  try {
    await signIn(email, password);
    // 성공하면 auth.js 의 onAuthChange 가 route() 를 다시 불러 화면을 바꿉니다.
  } catch (err) {
    setError('login-error', err.message);
  }
}

async function onSignupSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-password-confirm').value;
  setError('signup-error', '');
  if (!passwordOk(password)) return setError('signup-error', '비밀번호는 영문+숫자를 포함해 8자 이상이어야 해요.');
  if (password !== confirm) return setError('signup-error', '비밀번호가 서로 달라요.');
  try {
    await signUp(email, password);
    switchTab('login');
    document.getElementById('login-email').value = email;
    showToast('가입이 끝났어요. 관리자 승인 후 사용할 수 있어요.');
  } catch (err) {
    setError('signup-error', err.message);
  }
}

// ── 승인 대기 화면 ───────────────────────────────
function renderPending() {
  appMounted = false;
  root().innerHTML = `<div class="auth-shell"><div class="auth-card">
    ${brandHtml()}
    <div class="auth-status-icon">${icon('clock', 26)}</div>
    <div class="auth-status-title">관리자 승인을 기다리고 있어요</div>
    <p class="auth-status-text">승인이 끝나면 새로고침만으로 바로 들어갈 수 있어요.</p>
    <div class="auth-status-actions">
      <button type="button" class="btn btn-outline" id="pending-refresh">${icon('refresh-cw', 16)}<span>새로고침</span></button>
      <button type="button" class="btn btn-outline" id="pending-logout">${icon('log-out', 16)}<span>로그아웃</span></button>
    </div>
  </div></div>`;
  document.getElementById('pending-refresh').addEventListener('click', () => route(session));
  document.getElementById('pending-logout').addEventListener('click', () => document.dispatchEvent(new CustomEvent('linkplan:logout')));
}

// ── 비밀번호 변경(강제: 관리자 초기화 직후 / 임의: 「내 계정」 메뉴는 모달로 별도 처리) ──
function renderForcedPasswordChange() {
  appMounted = false;
  root().innerHTML = `<div class="auth-shell"><div class="auth-card">
    ${brandHtml()}
    <div class="auth-status-title">새 비밀번호를 정해 주세요</div>
    <p class="auth-status-text">관리자가 임시 비밀번호를 발급했어요. 새 비밀번호를 정해야 계속 쓸 수 있어요.</p>
    <form class="auth-form" id="forced-pw-form" novalidate>
      ${fieldHtml({ id: 'new-password', label: '새 비밀번호', type: 'password', autocomplete: 'new-password', withRule: true })}
      ${fieldHtml({ id: 'new-password-confirm', label: '새 비밀번호 확인', type: 'password', autocomplete: 'new-password' })}
      <div class="field-error" id="forced-pw-error" hidden>${icon('triangle-alert', 15)}<span></span></div>
      <div class="auth-actions"><button type="submit" class="btn btn-primary">비밀번호 바꾸기</button></div>
    </form>
  </div></div>`;
  bindPwToggles();
  bindRuleLive('new-password');
  document.getElementById('forced-pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = document.getElementById('new-password').value;
    const confirm = document.getElementById('new-password-confirm').value;
    setError('forced-pw-error', '');
    if (!passwordOk(pw)) return setError('forced-pw-error', '비밀번호는 영문+숫자를 포함해 8자 이상이어야 해요.');
    if (pw !== confirm) return setError('forced-pw-error', '비밀번호가 서로 달라요.');
    try {
      await changePassword(pw);
      showToast('비밀번호를 바꿨어요.');
      await route(await getSession());
    } catch (err) {
      setError('forced-pw-error', err.message);
    }
  });
}

// ── 「내 계정」 메뉴에서 여는 비밀번호 변경(모달, 앱은 그대로 유지) ──
function closePasswordModal() {
  document.querySelector('.modal-backdrop')?.remove();
  document.removeEventListener('keydown', onModalKeydown);
}
function onModalKeydown(e) { if (e.key === 'Escape') closePasswordModal(); }

function openPasswordModal() {
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = `<div class="auth-card" role="dialog" aria-modal="true" aria-label="비밀번호 바꾸기">
    <div class="auth-status-title">비밀번호 바꾸기</div>
    <form class="auth-form" id="modal-pw-form" novalidate>
      ${fieldHtml({ id: 'modal-new-password', label: '새 비밀번호', type: 'password', autocomplete: 'new-password', withRule: true })}
      ${fieldHtml({ id: 'modal-new-password-confirm', label: '새 비밀번호 확인', type: 'password', autocomplete: 'new-password' })}
      <div class="field-error" id="modal-pw-error" hidden>${icon('triangle-alert', 15)}<span></span></div>
      <div class="auth-actions">
        <button type="submit" class="btn btn-primary">바꾸기</button>
        <button type="button" class="btn btn-ghost" id="modal-pw-cancel">취소</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) closePasswordModal(); });
  document.addEventListener('keydown', onModalKeydown);
  bindPwToggles(back);
  bindRuleLive('modal-new-password', back);
  back.querySelector('#modal-pw-cancel').addEventListener('click', closePasswordModal);
  back.querySelector('#modal-pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = back.querySelector('#modal-new-password').value;
    const confirm = back.querySelector('#modal-new-password-confirm').value;
    setError('modal-pw-error', '', back);
    if (!passwordOk(pw)) return setError('modal-pw-error', '비밀번호는 영문+숫자를 포함해 8자 이상이어야 해요.', back);
    if (pw !== confirm) return setError('modal-pw-error', '비밀번호가 서로 달라요.', back);
    try {
      await changePassword(pw);
      closePasswordModal();
      showToast('비밀번호를 바꿨어요.');
    } catch (err) {
      setError('modal-pw-error', err.message, back);
    }
  });
  back.querySelector('#modal-new-password').focus();
}

// ── 앱(보드·링크 뷰) ─────────────────────────────
function renderLoading() {
  root().innerHTML = `<div class="auth-shell"><div class="auth-card">${brandHtml()}<p class="auth-status-text" style="text-align:center">불러오는 중이에요…</p></div></div>`;
}

async function renderApp() {
  if (!appMounted) {
    appMounted = true;
    renderLoading();
    // 뷰·테마는 계정 설정(user_settings)이 기준입니다(PRD 6-8, P1-10 을 앞당겨 지금 붙임).
    // localStorage 값은 이 조회가 끝나기 전 깜빡임을 막는 캐시일 뿐입니다.
    try {
      const settings = await getSettings();
      if (settings) { setTheme(settings.theme); setView(settings.view_mode); }
    } catch (err) {
      console.error('설정을 불러오지 못했어요. 이전에 저장된 값으로 계속해요.', err);
    }
    await loadState();
    renderShell(root());
    bindShell();
    mountBoard();
    mountLink();
  }
  setUser({ email: session.user.email, isAdmin: Boolean(profile?.is_admin) });
}

// ── 라우팅: 세션 → 승인 여부 → 비밀번호 초기화 여부 순으로 화면을 고릅니다 ──
// signUp() 이 내부에서 바로 signOut() 하듯, 인증 이벤트가 연달아 일어나면 route() 도 겹쳐 불립니다.
// 프로필 조회(네트워크)가 느린 낡은 호출이 나중에 끝나 최신 화면을 덮어쓰지 않도록 순번으로 막습니다.
let routeSeq = 0;
async function route(nextSession) {
  const mySeq = ++routeSeq;
  session = nextSession;
  if (!session) { renderAuthCard(); return; }
  let nextProfile;
  try {
    nextProfile = await getProfile(session.user.id);
  } catch {
    // 가입 트리거가 아직 끝나지 않았거나 조회에 실패하면 승인 대기로 취급합니다.
    nextProfile = { approved: false, is_admin: false };
  }
  if (mySeq !== routeSeq) return; // 그 사이 더 최신 route() 가 있었으면 이 결과는 버립니다.
  profile = nextProfile;
  if (!profile.approved) return renderPending();
  if (mustChangePassword(session)) return renderForcedPasswordChange();
  return renderApp();
}

export async function startAuthGate() {
  document.addEventListener('linkplan:logout', async () => {
    await signOut();
    // 셸·보드·링크 뷰가 document 에 걸어 둔 리스너를 깔끔히 정리하기 위해 새로고침합니다.
    window.location.reload();
  });
  document.addEventListener('linkplan:password', () => openPasswordModal());

  await route(await getSession());
  onAuthChange((next) => route(next));
}
