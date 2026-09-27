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
        <p class="goal-empty">아직 연간 목표가 없어요.</p>
        <div class="solo-row" title="독립 할 일">
          <span class="solo-ic solo-ic--inbox">${icon('inbox', 15)}</span>
          <span class="solo-ic solo-ic--unlink">${icon('unlink', 20)}</span>
          <span class="solo-name">독립 할 일</span>
          <span class="solo-count num">0</span>
        </div>
      </section>
      <div class="user-box">
        <div class="avatar">${icon('user', 16)}</div>
        <span class="user-name">내 계정</span>
      </div>
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
      <section class="content" aria-label="본문">
        <div class="empty">
          <div class="empty-ic">${icon('inbox', 28)}</div>
          <p class="empty-title only-board">아직 할 일이 없어요</p>
          <p class="empty-title only-link">연결할 계획이 아직 없어요</p>
          <p class="empty-text">새 할 일을 만들면 이곳에서 볼 수 있어요.</p>
          <button type="button" class="btn btn-primary">${icon('plus', 18)}<span>새 할 일</span></button>
        </div>
      </section>
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

export function bindShell() {
  root.dataset.period = root.dataset.period || 'week';
  document.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-view-btn]');
    if (viewBtn) return setView(viewBtn.dataset.viewBtn);
    const periodBtn = e.target.closest('[data-period-btn]');
    if (periodBtn) {
      root.dataset.period = periodBtn.dataset.periodBtn;
      syncPressed();
    }
  });
  document.addEventListener('linkplan:change', syncPressed);
  syncPressed();
}
