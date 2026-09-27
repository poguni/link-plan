// 앱 셸(뼈대)을 그립니다. DOM 은 하나이고, 테마별로 보이는 조각은 css/shell.css 가 정합니다.
// Phase 1 에서는 뷰 전환과 기간 선택 표시만 동작하고, 나머지 버튼은 자리만 잡아 둡니다.
import { icon } from './icons.js';
import { getView, setView } from './theme.js';

const PERIODS = [
  { key: 'day', label: '일일', icon: 'sun' },
  { key: 'week', label: '주간', icon: 'calendar-days' },
  { key: 'month', label: '월간', icon: 'calendar' },
  { key: 'year', label: '연간', icon: 'flag' },
];

const root = document.documentElement;

function brand(extra = '') {
  return `<div class="brand">
    <div class="logo-mark">${icon('link', 18)}</div>
    <div class="brand-text">
      <div class="brand-line"><span class="brand-name">링크 플랜</span><span class="brand-en">Link Plan</span></div>
      ${extra}
    </div>
  </div>`;
}

function viewSeg() {
  return `<div class="seg seg--view" role="group" aria-label="뷰 전환">
    <button type="button" class="seg-btn" data-view-btn="board" aria-pressed="false">${icon('dashboard', 15)}<span>보드 뷰</span></button>
    <button type="button" class="seg-btn" data-view-btn="link" aria-pressed="false">${icon('link', 15)}<span>링크 뷰</span></button>
  </div>`;
}

function periodSeg() {
  const buttons = PERIODS.map((p) =>
    `<button type="button" class="seg-btn" data-period-btn="${p.key}" aria-pressed="false">${icon(p.icon, 16, 'seg-ic')}<span>${p.label}</span></button>`
  ).join('');
  return `<div class="seg seg--period" role="group" aria-label="기간 전환">${buttons}</div>`;
}

// 기간 이름과 날짜는 Phase 6 에서 실제 값으로 바꿉니다.
function periodNav() {
  return `<div class="period-nav">
    <button type="button" class="icon-btn icon-btn--md" aria-label="이전 주">${icon('chev-l', 16)}</button>
    <span class="period-label"><span class="pl-long">2026년 9월 4주차 · 9/21 – 9/27</span><span class="pl-short">9월 4주차</span></span>
    <button type="button" class="icon-btn icon-btn--md" aria-label="다음 주">${icon('chev-r', 16)}</button>
  </div>`;
}

const searchButton = () => `<button type="button" class="icon-btn icon-btn--box btn-search" aria-label="검색">${icon('search', 18)}</button>`;
const newTaskButton = () => `<button type="button" class="btn btn-primary">${icon('plus', 18)}<span>새 할 일</span></button>`;

function navItem(view, iconId, label) {
  return `<button type="button" class="nav-item" data-view-btn="${view}" aria-pressed="false" aria-label="${label}">${icon(iconId, 18)}<span class="label">${label}</span></button>`;
}

export function renderShell(app) {
  app.innerHTML = `<div class="shell">
    <header class="topbar">
      ${brand(`<div class="brand-tagline">${icon('sparkles', 14)}<span>오늘도 한 칸씩, 차근차근 이어가요</span></div>`)}
      ${viewSeg()}
      <div class="topbar-right">
        ${periodSeg()}
        ${periodNav()}
        ${searchButton()}
        ${newTaskButton()}
      </div>
    </header>

    <aside class="goal-panel" aria-label="목표 패널">
      <div class="side-brand">${brand()}</div>
      <nav class="side-nav" aria-label="뷰">
        <div class="side-label">뷰</div>
        ${navItem('board', 'dashboard', '보드 뷰')}
        ${navItem('link', 'link', '링크 뷰')}
      </nav>
      <section class="goal-section" aria-label="연간 목표">
        <div class="goal-heading" title="연간 목표">
          ${icon('flag', 14, 'gh-flag')}${icon('sprout', 20, 'gh-sprout')}<span class="gh-text">연간 목표</span>
        </div>
        <div class="goal-list" id="goal-list"></div>
        <button type="button" class="solo-row" id="solo-row" data-filter-solo aria-pressed="false" title="독립 할 일">
          <span class="solo-ic solo-ic--inbox">${icon('inbox', 15)}</span>
          <span class="solo-ic solo-ic--unlink">${icon('unlink', 20)}</span>
          <span class="solo-name">독립 할 일</span>
          <span class="solo-count num" id="solo-count">0</span>
        </button>
      </section>
      <button type="button" class="user-box" id="user-menu-btn" aria-haspopup="menu" aria-expanded="false">
        <div class="avatar">${icon('user', 16)}</div>
        <span class="user-name" id="user-email">내 계정</span>
      </button>
    </aside>

    <main class="main">
      <div class="main-head">
        <div class="mh-left">
          ${periodNav()}
          <h1 class="page-title only-board">이번 주 보드</h1>
        </div>
        <div class="mh-right">
          <div class="only-link">${viewSeg()}</div>
          ${periodSeg()}
          ${searchButton()}
          ${newTaskButton()}
        </div>
      </div>
      <section class="chain only-board" id="chain" aria-label="이번 주 계획이 이어지는 목표"></section>
      <section class="content" aria-label="본문">
        <div class="board only-board" id="board"></div>
        <div class="linkview only-link" id="linkview">
          <div class="link-graph" id="link-graph">
            <svg class="link-svg" id="link-svg" aria-hidden="true"></svg>
            <div class="link-nodes" id="link-nodes"></div>
          </div>
          <div class="tray-wrap">
            <div class="tray-hint">${icon('sparkles', 15)}<span>노드의 점을 다른 계획으로 끌어다 놓으면 새로 이어져요</span></div>
            <div class="tray" id="tray" aria-label="상태 트레이"></div>
          </div>
        </div>
        <p class="link-disabled-msg only-link" id="link-disabled-msg" hidden>화면 폭이 좁아서 링크 뷰를 쓸 수 없어요. 보드 뷰로 볼게요.</p>
      </section>
      <section class="banner only-board" id="banner" aria-label="이번 주 응원"></section>
    </main>
  </div>`;
}

// 선택 표시는 aria-pressed 하나로 맞춥니다(스타일과 스크린 리더가 같은 값을 봅니다).
function syncPressed() {
  const view = getView();
  const period = root.dataset.period;
  document.querySelectorAll('[data-view-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.viewBtn === view)));
  document.querySelectorAll('[data-period-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.periodBtn === period)));
}

// 화면 폭 1024px 미만이면 링크 뷰를 쓸 수 없습니다(PRD P0-12). 버튼을 비활성화하고, 링크 뷰를 보던 중이면 보드 뷰로 돌려보냅니다.
const MIN_LINK_WIDTH = 1024;
function enforceLinkAvailability() {
  const allowed = window.innerWidth >= MIN_LINK_WIDTH;
  document.querySelectorAll('[data-view-btn="link"]').forEach((b) => { b.disabled = !allowed; });
  document.getElementById('link-disabled-msg').hidden = allowed || getView() !== 'link';
  if (!allowed && getView() === 'link') setView('board');
}

// ── 사용자 영역(아바타·이메일) · 메뉴(내 계정·관리자 페이지·로그아웃, PRD 6-10) ──
export function setUser({ email, isAdmin }) {
  const label = document.getElementById('user-email');
  if (label) label.textContent = email;
  const btn = document.getElementById('user-menu-btn');
  if (btn) btn.dataset.admin = isAdmin ? '1' : '';
}

let userMenu = null;
function closeUserMenu() {
  if (!userMenu) return;
  userMenu.anchor.setAttribute('aria-expanded', 'false');
  userMenu.menu.remove();
  document.removeEventListener('pointerdown', userMenu.onOutside, true);
  userMenu = null;
}
function openUserMenu(anchor) {
  closeUserMenu();
  const isAdmin = anchor.dataset.admin === '1';
  const menu = document.createElement('div');
  menu.className = 'status-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', '내 계정 메뉴');
  menu.innerHTML = `
    <button type="button" class="status-menu-item" role="menuitem" data-user-action="password">
      <span class="status-ic">${icon('lock', 18)}</span><span class="status-name">내 계정(비밀번호 변경)</span>
    </button>
    ${isAdmin ? `<a class="status-menu-item" role="menuitem" href="admin.html">
      <span class="status-ic">${icon('shield', 18)}</span><span class="status-name">관리자 페이지</span>
    </a>` : ''}
    <button type="button" class="status-menu-item" role="menuitem" data-user-action="logout">
      <span class="status-ic">${icon('log-out', 18)}</span><span class="status-name">로그아웃</span>
    </button>`;
  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${Math.min(rect.top, window.innerHeight - menu.offsetHeight - 8)}px`;
  menu.style.left = `${Math.min(rect.right + 8, window.innerWidth - menu.offsetWidth - 8)}px`;
  anchor.setAttribute('aria-expanded', 'true');
  const onOutside = (e) => { if (!menu.contains(e.target) && e.target !== anchor) closeUserMenu(); };
  document.addEventListener('pointerdown', onOutside, true);
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-user-action]');
    if (!item) return;
    const action = item.dataset.userAction;
    closeUserMenu();
    document.dispatchEvent(new CustomEvent(`linkplan:${action}`));
  });
  userMenu = { menu, anchor, onOutside };
}

export function bindShell() {
  root.dataset.period = root.dataset.period || 'week';
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-view-btn]');
    if (viewBtn && !viewBtn.disabled) return setView(viewBtn.dataset.viewBtn);
    const periodBtn = e.target.closest('[data-period-btn]');
    if (periodBtn) {
      root.dataset.period = periodBtn.dataset.periodBtn;
      syncPressed();
      return;
    }
    const userBtn = e.target.closest('#user-menu-btn');
    if (userBtn) openUserMenu(userBtn);
  });
  document.addEventListener('linkplan:change', () => { syncPressed(); enforceLinkAvailability(); });
  window.addEventListener('resize', enforceLinkAvailability);
  syncPressed();
  enforceLinkAvailability();
}
