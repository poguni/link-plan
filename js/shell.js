// 앱 셸(뼈대)을 그립니다. DOM 은 하나이고, 테마별로 보이는 조각은 css/shell.css 가 정합니다.
// Phase 1 에서는 뷰 전환과 기간 선택 표시만 동작하고, 나머지 버튼은 자리만 잡아 둡니다.
import { icon } from './icons.js';
import { getView, setView, getTheme, setTheme, THEMES } from './theme.js';
import { getPeriod, getAnchor, setAnchor, shiftAnchor, navLabel } from './period.js';
import { saveSettings } from './api.js';
import { getState } from './state.js';
import { esc, STATUSES, LEVELS } from './ui.js';
import { getFilter, isActive as isFilterActive, setQuery, setStatus, setScope, clearScope, clearFilter, subscribe as subscribeFilter } from './filter.js';

const THEME_LABEL = { clean: '클린', night: '나이트', pastel: '파스텔' };

// 뷰·테마를 바꿀 때마다 계정에 저장합니다(PRD 6-8, P1-10 을 앞당겨 지금 붙임). 저장 실패는 화면을 막지 않고 조용히 기록만 합니다.
let saveTimer = null;
function persistSettings() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveSettings({ theme: getTheme(), view_mode: getView() }).catch(() => {}); }, 400);
}

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

// 라벨 텍스트는 mountBoard() 가 곧바로 updatePeriodDisplay() 로 채웁니다(period.js 기준).
function periodNav() {
  return `<div class="period-nav">
    <button type="button" class="icon-btn icon-btn--md" data-period-nav="prev" aria-label="이전">${icon('chev-l', 16)}</button>
    <span class="period-label"><span class="pl-long"></span><span class="pl-short"></span></span>
    <button type="button" class="icon-btn icon-btn--md" data-period-nav="next" aria-label="다음">${icon('chev-r', 16)}</button>
  </div>`;
}

const searchButton = () => `<button type="button" class="icon-btn icon-btn--box btn-search" aria-label="검색">${icon('search', 18)}</button>`;
const newTaskButton = () => `<button type="button" class="btn btn-primary" data-task-add>${icon('plus', 18)}<span>새 할 일</span></button>`;

// 기간 라벨·페이지 제목을 갱신합니다(board.js 가 렌더링마다 호출).
export function updatePeriodDisplay({ long, short, title }) {
  document.querySelectorAll('.pl-long').forEach((el) => { el.textContent = long; });
  document.querySelectorAll('.pl-short').forEach((el) => { el.textContent = short; });
  document.querySelectorAll('.page-title').forEach((el) => { el.textContent = title; });
  document.querySelectorAll('[data-period-nav]').forEach((btn) => btn.setAttribute('aria-label', navLabel(getPeriod(), btn.dataset.periodNav)));
}

function navItem(view, iconId, label) {
  return `<button type="button" class="nav-item" data-view-btn="${view}" aria-pressed="false" aria-label="${label}">${icon(iconId, 18)}<span class="label">${label}</span></button>`;
}

export function renderShell(app) {
  app.innerHTML = `<div class="shell">
    <header class="topbar">
      ${brand(`<div class="brand-tagline">${icon('sparkles', 14)}<span>오늘도 한 칸씩, 차근차근 이어가요</span></div>`)}
      <button type="button" class="icon-btn icon-btn--box menu-btn" id="menu-btn" aria-label="메뉴 열기" aria-expanded="false" aria-controls="goal-panel">${icon('menu', 20)}</button>
      ${viewSeg()}
      <div class="topbar-right">
        ${periodSeg()}
        ${periodNav()}
        ${searchButton()}
        ${newTaskButton()}
      </div>
    </header>

    <aside class="goal-panel" id="goal-panel" aria-label="목표 패널">
      <div class="side-brand">${brand()}</div>
      <button type="button" class="icon-btn drawer-close" id="drawer-close" aria-label="메뉴 닫기">${icon('x', 20)}</button>
      <nav class="side-nav" aria-label="뷰">
        <div class="side-label">뷰</div>
        ${navItem('board', 'dashboard', '보드 뷰')}
        ${navItem('link', 'link', '링크 뷰')}
      </nav>
      <div class="mobile-controls" aria-label="기간 전환">
        ${periodSeg()}
        ${periodNav()}
      </div>
      <section class="goal-section" aria-label="연간 목표">
        <div class="goal-heading" title="연간 목표">
          ${icon('flag', 14, 'gh-flag')}${icon('sprout', 20, 'gh-sprout')}<span class="gh-text">연간 목표</span>
          <button type="button" class="icon-btn" data-plan-add-year aria-label="연간 목표 추가">${icon('plus', 14)}</button>
        </div>
        <div class="goal-list" id="goal-list"></div>
        <button type="button" class="solo-row" id="solo-row" data-filter-solo aria-pressed="false" title="개별 할 일">
          <span class="solo-ic solo-ic--inbox">${icon('inbox', 15)}</span>
          <span class="solo-ic solo-ic--unlink">${icon('unlink', 20)}</span>
          <span class="solo-name">개별 할 일</span>
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
      <section class="carryover-bar only-board" id="carryover-bar" aria-label="미완료 이월" hidden></section>
      <section class="content" aria-label="본문">
        <div class="status-tabs only-board" id="status-tabs" role="tablist" aria-label="상태"></div>
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
    <div class="status-menu-title">테마</div>
    <div class="seg" role="radiogroup" aria-label="테마 선택" style="margin:2px 6px 10px">
      ${THEMES.map((t) => `<button type="button" class="seg-btn" data-theme-set="${t}" role="radio" aria-checked="${getTheme() === t}" aria-pressed="${getTheme() === t}">${THEME_LABEL[t]}</button>`).join('')}
    </div>
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
    const themeBtn = e.target.closest('[data-theme-set]');
    if (themeBtn) {
      setTheme(themeBtn.dataset.themeSet);
      persistSettings();
      menu.querySelectorAll('[data-theme-set]').forEach((b) => {
        const on = b.dataset.themeSet === themeBtn.dataset.themeSet;
        b.setAttribute('aria-checked', String(on));
        b.setAttribute('aria-pressed', String(on));
      });
      return;
    }
    const item = e.target.closest('[data-user-action]');
    if (!item) return;
    const action = item.dataset.userAction;
    closeUserMenu();
    document.dispatchEvent(new CustomEvent(`linkplan:${action}`));
  });
  userMenu = { menu, anchor, onOutside };
}

// ── 검색·필터(P1-7): 계획별·상태별·개별 할 일 필터 + 제목 검색. 보드·링크 뷰 공통이라 상단바의
// "검색" 버튼(테마마다 topbar 또는 main-head 안, 둘 중 화면에 보이는 쪽)에서 엽니다 ──
function planOptionsHtml(plans) {
  const groups = { yearly: '연간', monthly: '월간', weekly: '주간' };
  return Object.entries(groups).map(([type, label]) => {
    const items = plans.filter((p) => p.plan_type === type);
    if (!items.length) return '';
    return `<optgroup label="${label}">${items.map((p) => `<option value="plan:${esc(p.id)}">${esc(p.title)}</option>`).join('')}</optgroup>`;
  }).join('');
}

function syncSearchIndicator() {
  document.querySelectorAll('.btn-search').forEach((b) => b.classList.toggle('is-active', isFilterActive()));
}

let filterPanel = null;
function closeFilterPanel() {
  if (!filterPanel) return;
  filterPanel.anchor.setAttribute('aria-expanded', 'false');
  filterPanel.panel.remove();
  document.removeEventListener('pointerdown', filterPanel.onOutside, true);
  filterPanel = null;
}
function openFilterPanel(anchor) {
  closeFilterPanel();
  const { query, status, scope } = getFilter();
  const plans = getState().plans;
  const panel = document.createElement('div');
  panel.className = 'status-menu filter-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '검색·필터');
  panel.innerHTML = `
    <div class="status-menu-title">검색·필터</div>
    <div class="field" style="padding:0 6px">
      <label class="field-label" for="filter-query">검색</label>
      <input class="field-input" id="filter-query" type="search" maxlength="100" placeholder="할 일 제목" value="${esc(query)}">
    </div>
    <div class="field" style="padding:8px 6px 0">
      <span class="field-label">상태</span>
      <div class="seg" role="group" aria-label="상태 필터">
        ${Object.entries(STATUSES).map(([key, v]) => `<button type="button" class="seg-btn" data-filter-status="${key}" aria-pressed="${status === key}">${icon(v.icon, 14, 'seg-ic')}<span>${v.label}</span></button>`).join('')}
      </div>
    </div>
    <div class="field" style="padding:8px 6px 0">
      <label class="field-label" for="filter-plan">계획</label>
      <select class="field-input" id="filter-plan">
        <option value="">전체</option>
        <option value="solo" ${scope?.type === 'solo' ? 'selected' : ''}>${LEVELS.solo.label}만</option>
        ${planOptionsHtml(plans)}
      </select>
    </div>
    <button type="button" class="status-menu-item" id="filter-clear" role="menuitem">
      <span class="status-ic">${icon('x', 16)}</span><span class="status-name">필터 지우기</span>
    </button>`;
  if (scope?.type === 'plan') panel.querySelector(`option[value="plan:${CSS.escape(scope.id)}"]`)?.setAttribute('selected', '');
  document.body.appendChild(panel);
  const rect = anchor.getBoundingClientRect();
  panel.style.top = `${Math.min(rect.bottom + 6, window.innerHeight - panel.offsetHeight - 8)}px`;
  panel.style.left = `${Math.min(rect.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - 8)}px`;
  anchor.setAttribute('aria-expanded', 'true');

  panel.querySelector('#filter-query').addEventListener('input', (e) => setQuery(e.target.value));
  panel.querySelectorAll('[data-filter-status]').forEach((b) => b.addEventListener('click', () => {
    setStatus(b.dataset.filterStatus);
    panel.querySelectorAll('[data-filter-status]').forEach((btn) => btn.setAttribute('aria-pressed', String(getFilter().status === btn.dataset.filterStatus)));
  }));
  panel.querySelector('#filter-plan').addEventListener('change', (e) => {
    const v = e.target.value;
    if (v === 'solo') setScope({ type: 'solo', id: null });
    else if (v.startsWith('plan:')) setScope({ type: 'plan', id: v.slice(5) });
    else clearScope();
  });
  panel.querySelector('#filter-clear').addEventListener('click', () => { clearFilter(); closeFilterPanel(); });

  const onOutside = (e) => { if (!panel.contains(e.target) && e.target !== anchor) closeFilterPanel(); };
  document.addEventListener('pointerdown', onOutside, true);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closeFilterPanel(); anchor.focus(); } });
  filterPanel = { panel, anchor, onOutside };
  panel.querySelector('#filter-query').focus();
}

// ── 600px 미만: 목표 패널이 햄버거로 여는 드로어가 됩니다(DESIGN.md 9절) ──
// 닫혀 있을 때는 transform 으로 화면 밖에 둘 뿐이라 그대로 두면 키보드 포커스·스크린 리더가
// 여전히 닿습니다. inert 로 닫힌 드로어를 완전히 비활성화합니다(DESIGN.md 8절 접근성).
const mobileMQ = window.matchMedia('(max-width: 599px)');
function syncPanelInert() {
  const panel = document.getElementById('goal-panel');
  if (!panel) return;
  panel.toggleAttribute('inert', mobileMQ.matches && !root.classList.contains('is-menu-open'));
}
mobileMQ.addEventListener('change', syncPanelInert);

function closeMenu() {
  root.classList.remove('is-menu-open');
  document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'false');
  document.getElementById('menu-backdrop')?.remove();
  syncPanelInert();
}
function openMenu() {
  root.classList.add('is-menu-open');
  document.getElementById('menu-btn')?.setAttribute('aria-expanded', 'true');
  const backdrop = document.createElement('div');
  backdrop.id = 'menu-backdrop';
  backdrop.className = 'menu-backdrop';
  backdrop.addEventListener('click', closeMenu);
  // .shell 이 자체 쌓임 맥락(position:relative + z-index)을 만들어서, body에 바로 붙이면
  // .goal-panel(z-index:150) 보다 이 배경이 위로 뜹니다. .shell 안에 넣어 같은 맥락에서 비교되게 합니다.
  document.querySelector('.shell').appendChild(backdrop);
  syncPanelInert();
}

export function bindShell() {
  root.dataset.period = root.dataset.period || 'week';
  root.dataset.mobileStatus = root.dataset.mobileStatus || 'todo';
  syncPanelInert();
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-view-btn]');
    if (viewBtn && !viewBtn.disabled) { setView(viewBtn.dataset.viewBtn); persistSettings(); closeMenu(); return; }
    const periodBtn = e.target.closest('[data-period-btn]');
    if (periodBtn) {
      root.dataset.period = periodBtn.dataset.periodBtn;
      syncPressed();
      document.dispatchEvent(new CustomEvent('linkplan:change'));
      return;
    }
    const periodNavBtn = e.target.closest('[data-period-nav]');
    if (periodNavBtn) {
      setAnchor(shiftAnchor(getPeriod(), getAnchor(), periodNavBtn.dataset.periodNav === 'prev' ? -1 : 1));
      document.dispatchEvent(new CustomEvent('linkplan:change'));
      return;
    }
    const userBtn = e.target.closest('#user-menu-btn');
    if (userBtn) return openUserMenu(userBtn);
    const searchBtn = e.target.closest('.btn-search');
    if (searchBtn) return openFilterPanel(searchBtn);
    if (e.target.closest('#menu-btn')) return root.classList.contains('is-menu-open') ? closeMenu() : openMenu();
    if (e.target.closest('#drawer-close')) return closeMenu();
    if (e.target.closest('[data-filter-plan], [data-filter-solo]')) closeMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('is-menu-open')) closeMenu(); });
  document.addEventListener('linkplan:change', () => { syncPressed(); enforceLinkAvailability(); });
  window.addEventListener('resize', enforceLinkAvailability);
  subscribeFilter(syncSearchIndicator);
  syncPressed();
  enforceLinkAvailability();
  syncSearchIndicator();
}
