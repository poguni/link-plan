// 관리자 페이지(PRD P0-18~P0-23, 5-7). service_role 이 필요한 작업은 모두 Edge Function(admin-api)을 거칩니다.
// 이 화면의 관리자 판별(guard)은 화면 전환용일 뿐 보안 경계가 아닙니다 — admin-api 가 호출마다 서버에서 다시 확인합니다.
import { SUPABASE_URL } from '../config.js';
import { loadIcons, icon } from './icons.js';
import { initTheme } from './theme.js';
import { esc, showToast } from './ui.js';
import { supabase } from './api.js';
import { getSession, getProfile } from './auth.js';

const FN_URL = `${SUPABASE_URL}/functions/v1/admin-api`;
const root = () => document.getElementById('admin-root');

async function callAdmin(action, payload = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인이 필요해요.');
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '처리하지 못했어요.');
  return data;
}

let users = [];
let filter = 'all'; // 'all' | 'pending'
let search = '';
let selfId = null;

function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function visibleUsers() {
  let list = filter === 'pending' ? users.filter((u) => !u.approved) : users;
  const q = search.trim().toLowerCase();
  if (q) list = list.filter((u) => u.email.toLowerCase().includes(q));
  return list;
}

// ── 모달(할 일·계획 모달과 같은 방식: .modal-backdrop, Esc·바깥 클릭으로 닫기) ──
let onCloseKeydown = null;
function closeModal() {
  document.querySelector('.modal-backdrop')?.remove();
  if (onCloseKeydown) { document.removeEventListener('keydown', onCloseKeydown); onCloseKeydown = null; }
}
function mountModal(html, focusSelector) {
  closeModal();
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = html;
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) closeModal(); });
  onCloseKeydown = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', onCloseKeydown);
  back.querySelector(focusSelector)?.focus();
  return back;
}

// 대상 이메일을 다시 입력해야 활성화되는 위험 작업 확인 모달(DESIGN.md 10절: 삭제·데이터 삭제 공통).
function confirmByEmail({ title, text, confirmLabel, email, onConfirm }) {
  const back = mountModal(`<div class="modal-card" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-title">${esc(title)}</div>
    <p class="empty-text">${text}</p>
    <div class="field">
      <label class="field-label" for="confirm-email">확인을 위해 이메일을 다시 입력해 주세요</label>
      <input class="field-input" id="confirm-email" autocomplete="off" placeholder="${esc(email)}">
    </div>
    <div class="field-error" id="confirm-error" hidden>${icon('triangle-alert', 15)}<span></span></div>
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" id="confirm-cancel">취소</button>
      <button type="button" class="btn btn-outline btn-danger" id="confirm-go" disabled>${esc(confirmLabel)}</button>
    </div>
  </div>`, '#confirm-email');
  const input = back.querySelector('#confirm-email');
  const goBtn = back.querySelector('#confirm-go');
  input.addEventListener('input', () => { goBtn.disabled = input.value.trim() !== email; });
  back.querySelector('#confirm-cancel').addEventListener('click', closeModal);
  goBtn.addEventListener('click', async () => {
    goBtn.disabled = true;
    try {
      await onConfirm();
      closeModal();
    } catch (err) {
      const errorBox = back.querySelector('#confirm-error');
      errorBox.hidden = false;
      errorBox.querySelector('span').textContent = err.message;
      goBtn.disabled = false;
    }
  });
}

function confirmSimple({ title, text, confirmLabel, onConfirm }) {
  const back = mountModal(`<div class="auth-card" role="alertdialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="auth-status-title">${esc(title)}</div>
    <p class="auth-status-text">${text}</p>
    <div class="auth-status-actions">
      <button type="button" class="btn btn-outline" id="simple-cancel">취소</button>
      <button type="button" class="btn btn-primary" id="simple-go">${esc(confirmLabel)}</button>
    </div>
  </div>`, '#simple-cancel');
  back.querySelector('#simple-cancel').addEventListener('click', closeModal);
  back.querySelector('#simple-go').addEventListener('click', async () => {
    try { await onConfirm(); closeModal(); }
    catch (err) { showToast(err.message); closeModal(); }
  });
}

function showTempPassword(email, tempPassword) {
  const back = mountModal(`<div class="modal-card" role="dialog" aria-modal="true" aria-label="임시 비밀번호">
    <div class="modal-title">${esc(email)} 임시 비밀번호</div>
    <p class="empty-text">지금만 볼 수 있어요. 창을 닫으면 다시 볼 수 없고, 서버에도 남지 않아요. 사용자에게 안전하게 전달해 주세요.</p>
    <div class="admin-secret-row">
      <input class="field-input" id="temp-pw" value="${esc(tempPassword)}" readonly>
      <button type="button" class="btn btn-outline" id="temp-pw-copy">복사</button>
    </div>
    <div class="modal-actions"><button type="button" class="btn btn-primary" id="temp-pw-close">닫기</button></div>
  </div>`, '#temp-pw');
  back.querySelector('#temp-pw').addEventListener('focus', (e) => e.target.select());
  back.querySelector('#temp-pw-copy').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      e.target.textContent = '복사됨';
      setTimeout(() => { e.target.textContent = '복사'; }, 1500);
    } catch { showToast('복사하지 못했어요. 직접 선택해서 복사해 주세요.'); }
  });
  back.querySelector('#temp-pw-close').addEventListener('click', closeModal);
}

function downloadJson(payload, email) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `링크플랜_${email.split('@')[0]}_${stamp}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// ── 목록 다시 불러오기 + 그리기 ──────────────────────
async function reload() {
  const { users: rows } = await callAdmin('list_users');
  users = rows;
  render();
}

function render() {
  const list = visibleUsers();
  const pendingCount = users.filter((u) => !u.approved).length;
  root().innerHTML = `<div class="admin-shell">
    <header class="admin-header">
      <div class="admin-title"><span class="logo-mark">${icon('shield', 18)}</span><span>관리자 페이지</span></div>
      <a class="btn btn-outline" href="index.html">${icon('chev-l', 16)}<span>앱으로</span></a>
    </header>
    <div class="admin-toolbar">
      <div class="seg" role="tablist" aria-label="상태 필터">
        <button type="button" class="seg-btn" data-filter="all" aria-pressed="${filter === 'all'}">전체 ${users.length}</button>
        <button type="button" class="seg-btn" data-filter="pending" aria-pressed="${filter === 'pending'}">승인 대기 ${pendingCount}</button>
      </div>
      <div class="field admin-search">
        <input class="field-input" id="admin-search-input" type="search" placeholder="이메일로 검색" value="${esc(search)}">
      </div>
    </div>
    <div class="admin-table-wrap">
      ${list.length ? `<table class="admin-table">
        <thead><tr><th>이메일</th><th>가입일</th><th>상태</th><th>작업</th></tr></thead>
        <tbody>${list.map(userRow).join('')}</tbody>
      </table>` : `<p class="admin-empty">${users.length ? '검색 결과가 없어요.' : '가입한 사용자가 없어요.'}</p>`}
    </div>
  </div>`;

  root().querySelector('#admin-search-input').addEventListener('input', (e) => { search = e.target.value; render(); });
  root().querySelectorAll('[data-filter]').forEach((btn) => btn.addEventListener('click', () => { filter = btn.dataset.filter; render(); }));
  root().querySelectorAll('[data-act]').forEach((btn) => btn.addEventListener('click', () => onAction(btn)));
}

function userRow(u) {
  const isSelf = u.id === selfId;
  return `<tr data-user-id="${esc(u.id)}">
    <td class="admin-cell-email">${esc(u.email)}${u.is_admin ? `<span class="chip chip--year admin-admin-badge">${icon('shield', 11)}관리자</span>` : ''}</td>
    <td>${fmtDate(u.created_at)}</td>
    <td><span class="admin-status admin-status--${u.approved ? 'approved' : 'pending'}">${u.approved ? '승인' : '대기'}</span></td>
    <td><div class="admin-actions">
      ${u.approved
        ? `<button type="button" class="btn btn-sm btn-outline" data-act="revoke" ${u.is_admin ? 'disabled title="관리자 계정은 승인을 취소할 수 없어요."' : ''}>승인 취소</button>`
        : `<button type="button" class="btn btn-sm btn-primary" data-act="approve">승인</button>`}
      <button type="button" class="icon-btn" data-act="reset" ${isSelf ? 'disabled title="자기 자신은 「내 계정」에서 바꿔요."' : ''} aria-label="비밀번호 초기화">${icon('lock', 15)}</button>
      <button type="button" class="icon-btn" data-act="export" aria-label="데이터 JSON 저장">${icon('download', 15)}</button>
      <button type="button" class="btn btn-sm btn-outline btn-danger" data-act="data" title="할 일·계획·연결·설정만 삭제(계정은 남음)">데이터 삭제</button>
      <button type="button" class="btn btn-sm btn-outline btn-danger" data-act="delete" ${(isSelf || u.is_admin) ? `disabled title="${isSelf ? '자기 자신은' : '관리자 계정은'} 삭제할 수 없어요."` : ''}>사용자 삭제</button>
    </div></td>
  </tr>`;
}

async function onAction(btn) {
  const tr = btn.closest('tr');
  const userId = tr.dataset.userId;
  const u = users.find((x) => x.id === userId);
  if (!u) return;
  const act = btn.dataset.act;

  if (act === 'approve' || act === 'revoke') {
    try {
      await callAdmin('set_approved', { user_id: userId, approved: act === 'approve' });
      showToast(act === 'approve' ? `${u.email} 승인했어요.` : `${u.email} 승인을 취소했어요.`);
      await reload();
    } catch (err) { showToast(err.message); }
    return;
  }

  if (act === 'reset') {
    return confirmSimple({
      title: '비밀번호를 초기화할까요?',
      text: `${u.email} 의 비밀번호를 임시 비밀번호로 바꿔요. 다음 로그인 때 새 비밀번호를 정해야 해요.`,
      confirmLabel: '초기화',
      onConfirm: async () => {
        const { temp_password } = await callAdmin('reset_password', { user_id: userId });
        showTempPassword(u.email, temp_password);
      },
    });
  }

  if (act === 'export') {
    try {
      const data = await callAdmin('export_user', { user_id: userId });
      downloadJson(data, u.email);
      showToast(`${u.email} 데이터를 저장했어요.`);
    } catch (err) { showToast(err.message); }
    return;
  }

  if (act === 'data') {
    return confirmByEmail({
      title: '데이터만 삭제할까요?',
      text: `${u.email} 의 할 일·계획·연결·설정을 지워요. 계정은 남아 있고 되돌릴 수 없어요. 먼저 위의 다운로드 버튼으로 JSON을 저장해 두는 걸 권해요.`,
      confirmLabel: '데이터 삭제',
      email: u.email,
      onConfirm: async () => {
        await callAdmin('delete_user_data', { user_id: userId, confirm_email: u.email });
        showToast(`${u.email} 데이터를 삭제했어요.`);
        await reload();
      },
    });
  }

  if (act === 'delete') {
    return confirmByEmail({
      title: '사용자를 삭제할까요?',
      text: `${u.email} 계정과 모든 데이터를 완전히 지워요. 되돌릴 수 없어요.`,
      confirmLabel: '사용자 삭제',
      email: u.email,
      onConfirm: async () => {
        await callAdmin('delete_user', { user_id: userId, confirm_email: u.email });
        showToast(`${u.email} 계정을 삭제했어요.`);
        await reload();
      },
    });
  }
}

// ── 진입: 관리자가 아니면 앱 화면으로 돌려보냅니다(서버가 다시 확인하는 화면 판단일 뿐, PRD P0-18) ──
async function start() {
  await loadIcons();
  initTheme();
  const session = await getSession();
  if (!session) { window.location.href = 'index.html'; return; }
  let profile;
  try { profile = await getProfile(session.user.id); } catch { profile = null; }
  if (!profile?.approved || !profile?.is_admin) { window.location.href = 'index.html'; return; }
  selfId = session.user.id;
  await reload();
}

start().catch((err) => {
  console.error(err);
  root().textContent = '관리자 화면을 불러오지 못했어요. 새로고침해 주세요.';
});
