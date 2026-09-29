// 보드 뷰: 좌측 목표 패널, 연결 사슬, 시작 전·진행 중·완료 3열 칸반, (파스텔) 응원 배너.
// 상태가 바뀔 때마다 통째로 다시 그립니다(할 일이 500개여도 충분히 빠른 규모). 상태 변경은 state.js 의 함수로만 합니다.
import { icon } from './icons.js';
import { chip, esc, progressBar, showToast, openModal, closeModal, LEVELS, STATUSES } from './ui.js';
import { getState, subscribe, setTaskStatus, updateTask, reorderTask, reorderPlan, carryOverTasks } from './state.js';
import { planProgress } from './progress.js';
import { openTaskModal, confirmDeleteTask } from './taskmodal.js';
import { openPlanModal } from './planmodal.js';
import { rangeOf, planForRange, overlaps, getPeriod, getAnchor, labelOf, titleOf } from './period.js';
import { updatePeriodDisplay } from './shell.js';
import { getFilter, setScope, matchTask, subscribe as subscribeFilter } from './filter.js';

const STATUS_KEYS = ['todo', 'doing', 'done'];
const TO_LABEL = { todo: '시작 전으로', doing: '진행 중으로', done: '완료로' };   // 조사(으로/로)까지 붙인 문구
const LEVEL_OF = { yearly: 'year', monthly: 'month', weekly: 'week' };
const LEVEL_RANK = { week: 0, month: 1, year: 2 };
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// ── 날짜 ────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const shortDate = (iso) => { const d = parseISO(iso); return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS[d.getDay()]})`; };

// ── 화면 상태(메모리) ───────────────────────────────
let els = {};
let sortables = [];
let goalSortable = null;
let pendingFocus = null;    // 다시 그린 뒤 포커스를 돌려줄 할 일 id(키보드 조작용)
let openMenu = null;

const levelOf = (plan) => LEVEL_OF[plan.plan_type];
const pctLabel = (pr) => (pr.pct === null ? '측정 전' : `${pr.pct}%`);
const linkedTaskIds = (s) => new Set(s.links.map((l) => l.task_id));

// 수행일이 선택된 기간 안에 있는 할 일만 봅니다(PRD P0-9). 수행일이 없는 할 일은 기간과 상관없이 항상
// 보이고, 카드의 날짜 자리에 "기한 없음"으로 표시됩니다(taskDate 참고) — 그래서 따로 목록을 만들지 않습니다.
function inPeriod(task, range) {
  if (!task.due_date) return true;
  return task.due_date >= isoOf(range.start) && task.due_date <= isoOf(range.end);
}

function visibleTasks(s) {
  const range = rangeOf(getPeriod(), getAnchor());
  return s.tasks.filter((t) => inPeriod(t, range) && matchTask(t, s));
}

// ── 좌측 목표 패널 ──────────────────────────────────
function planPill(plan, depth, s) {
  const level = levelOf(plan);
  const pr = planProgress(plan.id, s);
  const active = getFilter().scope?.type === 'plan' && getFilter().scope.id === plan.id;
  const value = pr.pct === 100 ? `${icon('star', 13)}달성!` : pctLabel(pr);
  return `<div class="goal-branch" data-depth="${depth}">
    <span class="goal-corner" aria-hidden="true">${icon('corner', 16)}</span>
    <button type="button" class="goal-pill goal-pill--${level}${active ? ' is-active' : ''}" data-filter-plan="${esc(plan.id)}" aria-pressed="${active}">
      <span class="pill-name">${icon(LEVELS[level].icon, 13)}${esc(plan.title)}</span>
      <span class="pill-pct num">${value}</span>
    </button>
    <button type="button" class="icon-btn pill-edit" data-plan-edit="${esc(plan.id)}" aria-label="${LEVELS[level].label} 계획 수정">${icon('pencil', 13)}</button>
  </div>`;
}

function goalCard(year, s) {
  const pr = planProgress(year.id, s);
  const active = getFilter().scope?.type === 'plan' && getFilter().scope.id === year.id;
  // 파스텔에서만 보이는 하위 계획(월간 → 그 아래 주간). 다른 테마에서는 CSS 로 숨깁니다.
  const branches = s.plans
    .filter((p) => p.parent_id === year.id)
    .map((m) => planPill(m, 1, s) + s.plans.filter((p) => p.parent_id === m.id).map((w) => planPill(w, 2, s)).join(''))
    .join('');
  return `<div class="goal-card${active ? ' is-active' : ''}" data-plan-id="${esc(year.id)}">
    <div class="goal-head-row">
      <button type="button" class="goal-main" data-filter-plan="${esc(year.id)}" aria-pressed="${active}">
        <span class="goal-dot" aria-hidden="true"></span>
        <span class="goal-ic" aria-hidden="true">${icon('sprout', 22)}</span>
        <span class="goal-text"><span class="goal-title">${esc(year.title)}</span><span class="goal-sub">연간 목표</span></span>
        <span class="goal-pct num">${pctLabel(pr)}</span>
      </button>
      <button type="button" class="icon-btn goal-edit" data-plan-edit="${esc(year.id)}" aria-label="연간 목표 수정">${icon('pencil', 14)}</button>
    </div>
    <div class="goal-bar">${progressBar(pr.pct, 'year', `${year.title} 진행률`, false)}</div>
    <div class="goal-count">${pr.done}/${pr.total} 완료</div>
    <div class="goal-children">${branches}</div>
  </div>`;
}

function renderGoals(s) {
  if (!s.ready) { els.goalList.innerHTML = ''; els.soloCount.textContent = ''; return; }
  const years = s.plans.filter((p) => p.plan_type === 'yearly').sort((a, b) => a.sort_order - b.sort_order);
  els.goalList.innerHTML = years.length
    ? years.map((y) => goalCard(y, s)).join('')
    : '<p class="goal-empty">아직 연간 목표가 없어요.</p>';
  const linked = linkedTaskIds(s);
  els.soloCount.textContent = s.tasks.filter((t) => !linked.has(t.id)).length;
  els.soloRow.setAttribute('aria-pressed', String(getFilter().scope?.type === 'solo'));
  initGoalDrag();
}

// 목표 패널의 연간 목표 순서를 끌어서 바꿉니다. 카드 안의 월간·주간 알약(파스텔의 펼친 트리, goal-branch)은
// 하위 계획이라 여기서 함께 끌리면 안 되므로 드래그 시작에서 제외합니다.
function initGoalDrag() {
  goalSortable?.destroy();
  goalSortable = null;
  if (!window.Sortable || !els.goalList) return;
  goalSortable = window.Sortable.create(els.goalList, {
    draggable: '.goal-card',
    filter: '.icon-btn, .goal-branch',
    preventOnFilter: false,
    animation: 150,
    forceFallback: true,
    fallbackOnBody: true,
    fallbackClass: 'is-dragging',
    ghostClass: 'is-ghost',
    chosenClass: 'is-chosen',
    delay: 400,
    delayOnTouchOnly: true,
    touchStartThreshold: 6,
    onEnd(evt) {
      if (evt.oldIndex !== evt.newIndex) reorderGoal(evt.item.dataset.planId, els.goalList);
    },
  });
}

function reorderGoal(planId, listEl) {
  const cards = [...listEl.querySelectorAll(':scope > .goal-card')];
  const idx = cards.findIndex((c) => c.dataset.planId === planId);
  if (idx === -1) return;
  const byId = new Map(getState().plans.map((p) => [p.id, p]));
  const prevOrder = idx > 0 ? byId.get(cards[idx - 1].dataset.planId)?.sort_order ?? null : null;
  const nextOrder = idx < cards.length - 1 ? byId.get(cards[idx + 1].dataset.planId)?.sort_order ?? null : null;
  reorderPlan(planId, orderBetween(prevOrder, nextOrder))
    .catch((err) => { console.error(err); showToast('순서를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'); });
}

// 왼쪽 목표 패널에서 계획을 하나 골라 둔 상태(스코프)면, 사슬도 그 계획의 갈래를 따라갑니다.
// 스코프가 없으면 기존처럼 날짜 범위로만 고릅니다(planForRange) — 그런데 같은 기간에 서로 다른 연간
// 목표 아래 계획이 함께 있으면 날짜만으로는 항상 같은 계획만 골라져서, 다른 연간 목표를 골라도 사슬이
// 안 바뀌는 문제가 있었습니다.
function resolveChainPlans(s, period) {
  const scope = getFilter().scope;
  const scoped = scope?.type === 'plan' ? s.plans.find((p) => p.id === scope.id) : null;
  const parentOf = (plan) => plan && s.plans.find((p) => p.id === plan.parent_id);

  if (scoped) {
    let week = scoped.plan_type === 'weekly' ? scoped : null;
    let month = scoped.plan_type === 'monthly' ? scoped : (week ? parentOf(week) : null);
    let year = scoped.plan_type === 'yearly' ? scoped : (month ? parentOf(month) : null);
    if (scoped.plan_type === 'yearly' && year) {
      month = s.plans.find((p) => p.plan_type === 'monthly' && p.parent_id === year.id && overlaps(p, rangeOf('month', getAnchor())));
      week = period !== 'month' && month ? s.plans.find((p) => p.plan_type === 'weekly' && p.parent_id === month.id && overlaps(p, rangeOf('week', getAnchor()))) : null;
    } else if (scoped.plan_type === 'monthly' && period !== 'month') {
      week = s.plans.find((p) => p.plan_type === 'weekly' && p.parent_id === month.id && overlaps(p, rangeOf('week', getAnchor())));
    }
    return { week, month, year };
  }

  if (period === 'month') {
    const month = planForRange(s.plans, 'monthly', rangeOf('month', getAnchor()));
    return { week: null, month, year: month ? parentOf(month) : planForRange(s.plans, 'yearly', rangeOf('year', getAnchor())) };
  }
  const week = planForRange(s.plans, 'weekly', rangeOf('week', getAnchor()));
  const month = week ? parentOf(week) : planForRange(s.plans, 'monthly', rangeOf('month', getAnchor()));
  return { week, month, year: month ? parentOf(month) : planForRange(s.plans, 'yearly', rangeOf('year', getAnchor())) };
}

// ── 연결 사슬(클린·나이트): 선택한 기간의 주간 → 월간 → 연간 ─
// 기간이 "연간"이면 목표 패널의 연간 카드 하나로 충분해 사슬은 비웁니다. "월간"이면 주간을 뺀 월→연만 보여 줍니다.
function renderChain(s) {
  if (!s.ready) { els.chain.innerHTML = ''; return; }
  const period = getPeriod();
  if (period === 'year') { els.chain.innerHTML = ''; return; }

  const { week, month, year } = resolveChainPlans(s, period);

  // 있는 단계만 보여 주고 끝내지 않습니다 — 예를 들어 연간만 있고 월간·주간이 없으면, 그 자리에
  // "만들기" 버튼을 둬서 클린·나이트에서도 (파스텔의 펼친 트리 없이) 계속 만들어 나갈 수 있게 합니다.
  const slots = period === 'month' ? [['monthly', month], ['yearly', year]] : [['weekly', week], ['monthly', month], ['yearly', year]];
  if (slots.every(([, plan]) => !plan)) { els.chain.innerHTML = ''; return; } // 아무 것도 없으면 목표 패널의 "연간 목표 추가"로 유도
  const items = slots.map(([planType, plan]) => (plan ? chainItemHtml(plan, s) : chainAddHtml(planType)));
  els.chain.innerHTML = `<div class="chain-title">${period === 'month' ? '이번 달' : '이번 주'} 계획이 이어지는 목표</div>
    <div class="chain-row">${items.join(`<div class="chain-link" aria-hidden="true">${icon('link', 18)}</div>`)}</div>`;
}

function chainItemHtml(plan, s) {
  const level = levelOf(plan);
  const pr = planProgress(plan.id, s);
  return `<div class="chain-item">
    <div class="chain-head">${chip(level)}<span class="chain-name">${esc(plan.title)}</span>
      <span class="chain-actions"><button type="button" class="icon-btn" data-plan-edit="${esc(plan.id)}" aria-label="${LEVELS[level].label} 계획 수정">${icon('pencil', 13)}</button></span>
    </div>
    ${progressBar(pr.pct, level, `${LEVELS[level].label} 계획 ${plan.title} 진행률`)}
  </div>`;
}

function chainAddHtml(planType) {
  const level = LEVEL_OF[planType];
  return `<div class="chain-item chain-item--empty">
    <button type="button" class="btn btn-sm btn-outline" data-plan-create="${planType}">${icon('plus', 14)}<span>${LEVELS[level].label} 계획 만들기</span></button>
  </div>`;
}

// ── 칸반 ────────────────────────────────────────────
function taskChips(task, s) {
  const plans = s.links
    .filter((l) => l.task_id === task.id)
    .map((l) => s.plans.find((p) => p.id === l.plan_id))
    .filter(Boolean)
    .sort((a, b) => LEVEL_RANK[levelOf(a)] - LEVEL_RANK[levelOf(b)]);
  if (!plans.length) return chip('solo');
  return plans.map((p) => chip(levelOf(p), `${LEVELS[levelOf(p)].label} · ${p.title}`)).join('');
}

function taskDate(task) {
  if (task.status === 'done') {
    return `<span class="card-date">${icon('circle-check', 14)}${task.due_date ? `${shortDate(task.due_date)} 완료` : '완료'}</span>`;
  }
  if (!task.due_date) return `<span class="card-date">${icon('calendar', 14)}기한 없음</span>`;
  const today = task.due_date === isoOf(new Date());
  return `<span class="card-date${today ? ' is-today' : ''}">${icon('calendar', 14)}${today ? '오늘 · ' : ''}${shortDate(task.due_date)}</span>`;
}

function taskCard(task, s) {
  return `<article class="task-card" data-task-id="${esc(task.id)}" data-status="${task.status}" tabindex="0" aria-keyshortcuts="Enter"
      aria-label="${esc(task.title)}, ${STATUSES[task.status].label}. Enter 키를 누르면 상태를 바꿀 수 있어요.">
    <div class="card-body">
      <div class="card-head"><span class="grip" aria-hidden="true">${icon('grip', 16)}</span><div class="card-title">${esc(task.title)}</div>
        <button type="button" class="icon-btn icon-btn--favorite" data-task-favorite="${esc(task.id)}" aria-pressed="${task.is_favorite ? 'true' : 'false'}" aria-label="${task.is_favorite ? '중요 표시 해제' : '중요 표시'}">${icon('heart', 15)}</button>
      </div>
      <div class="card-chips">${taskChips(task, s)}</div>
      <div class="card-foot">
        ${taskDate(task)}
        <span class="card-actions">
          <button type="button" class="icon-btn" data-task-edit="${esc(task.id)}" aria-label="수정">${icon('pencil', 15)}</button>
          <button type="button" class="icon-btn" data-task-delete="${esc(task.id)}" aria-label="삭제">${icon('trash', 15)}</button>
        </span>
      </div>
    </div>
  </article>`;
}

function columnHtml(status, tasks, s) {
  const { icon: iconId, label } = STATUSES[status];
  return `<section class="column" data-status="${status}" aria-label="${label}">
    <div class="column-head">
      <span class="column-status">${icon(iconId, 18)}</span>
      <span class="column-name">${label}</span>
      <span class="count">${tasks.length}</span>
      <span class="column-spacer"></span>
      <button type="button" class="icon-btn column-add" data-task-add aria-label="${label}에 할 일 추가">${icon('plus', 16)}</button>
    </div>
    <div class="drop-hint" aria-hidden="true">${icon('circle-check', 16)}여기에 놓으면 ${TO_LABEL[status]} 바뀌어요</div>
    <div class="column-list" data-status="${status}">
      ${tasks.map((t) => taskCard(t, s)).join('')}
      ${status === 'todo' ? `<button type="button" class="add-slot" data-task-add>${icon('plus', 18)}새 할 일 추가</button>` : ''}
    </div>
  </section>`;
}

function clearDropTarget() {
  els.board.querySelectorAll('.column.is-drop-target').forEach((c) => c.classList.remove('is-drop-target'));
}

function initDrag() {
  sortables.forEach((sortable) => sortable.destroy());
  sortables = [];
  if (!window.Sortable) { console.warn('SortableJS 를 불러오지 못했어요. 끌어서 옮기기는 쓸 수 없고, Enter 메뉴만 쓸 수 있어요.'); return; }
  els.board.querySelectorAll('.column-list').forEach((list) => {
    sortables.push(window.Sortable.create(list, {
      group: 'board',
      sort: true,                        // 같은 열 안의 순서 변경(P1-1). 순서는 onEnd 에서 저장합니다.
      draggable: '.task-card',
      filter: '.icon-btn',               // 수정·삭제 버튼 위에서는 끌기를 시작하지 않습니다.
      preventOnFilter: false,
      animation: 150,
      forceFallback: true,               // 끄는 카드를 실제 요소로 만들어 기울임·그림자를 입힙니다.
      fallbackOnBody: true,
      fallbackClass: 'is-dragging',
      ghostClass: 'is-ghost',
      chosenClass: 'is-chosen',
      delay: 400,                        // 터치는 0.4초 길게 눌러야 끌기가 시작됩니다(짧은 움직임은 스크롤, PRD 6-6).
      delayOnTouchOnly: true,
      touchStartThreshold: 6,
      onMove(evt) {
        clearDropTarget();
        if (evt.to !== evt.from) evt.to.closest('.column').classList.add('is-drop-target');
        return true;
      },
      onEnd(evt) {
        clearDropTarget();
        const taskId = evt.item.dataset.taskId;
        // 끌기가 완전히 끝난 뒤에 상태를 바꿔서, 다시 그리기가 SortableJS 의 마무리와 겹치지 않게 합니다.
        if (evt.from !== evt.to) setTimeout(() => moveTask(taskId, evt.to.dataset.status), 0);
        else if (evt.oldIndex !== evt.newIndex) setTimeout(() => reorderColumn(taskId, evt.to), 0);
      },
    }));
  });
}

// 같은 열 안에서 순서를 바꿉니다(P1-1). 드롭 직후의 실제 DOM 순서(cards)에서 이웃 카드를 찾고,
// 그 이웃들의 저장된 sort_order 사이의 중간값을 새 값으로 씁니다(같은 열의 다른 카드는 건드리지 않음).
export function orderBetween(before, after) {
  if (before == null && after == null) return 0;
  if (before == null) return after - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
}
function reorderColumn(taskId, listEl) {
  const cards = [...listEl.querySelectorAll('.task-card')];
  const idx = cards.findIndex((c) => c.dataset.taskId === taskId);
  if (idx === -1) return;
  const byId = new Map(getState().tasks.map((t) => [t.id, t]));
  const prevOrder = idx > 0 ? byId.get(cards[idx - 1].dataset.taskId)?.sort_order ?? null : null;
  const nextOrder = idx < cards.length - 1 ? byId.get(cards[idx + 1].dataset.taskId)?.sort_order ?? null : null;
  reorderTask(taskId, orderBetween(prevOrder, nextOrder))
    .catch((err) => { console.error(err); showToast('순서를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.'); });
}

// 데이터를 아직 못 불러왔으면(loadState 진행 중) 카드 모양 스켈레톤을 보여 줍니다(DESIGN.md 7절).
function skeletonColumnHtml(status) {
  const { icon: iconId, label } = STATUSES[status];
  return `<section class="column" data-status="${status}" aria-label="${label} 불러오는 중">
    <div class="column-head"><span class="column-status">${icon(iconId, 18)}</span><span class="column-name">${label}</span></div>
    <div class="column-list"><div class="skeleton-card" aria-hidden="true"></div><div class="skeleton-card" aria-hidden="true"></div></div>
  </section>`;
}

function renderColumns(s) {
  closeStatusMenu();
  if (!s.ready) {
    els.board.innerHTML = STATUS_KEYS.map((st) => skeletonColumnHtml(st)).join('');
    return;
  }
  const tasks = visibleTasks(s);
  els.board.innerHTML = STATUS_KEYS.map((st) => columnHtml(st, tasks.filter((t) => t.status === st).sort((a, b) => a.sort_order - b.sort_order), s)).join('');
  initDrag();
  if (pendingFocus) {
    els.board.querySelector(`[data-task-id="${CSS.escape(pendingFocus)}"]`)?.focus();
    pendingFocus = null;
  }
}

// ── 파스텔 응원 배너 ────────────────────────────────
// 샘플 데이터에는 완료 시각이 없어서, 요일별 체크는 완료된 할 일의 수행일로 대신합니다(Phase 6 에서 완료 시각을 씁니다).
function renderBanner(s) {
  if (!s.ready) { els.banner.innerHTML = ''; return; }
  const total = s.tasks.length;
  const done = s.tasks.filter((t) => t.status === 'done').length;
  const title = total === 0 ? '이번 주 할 일을 만들어 볼까요?'
    : done === total ? '이번 주 할 일을 모두 마쳤어요!'
    : done === 0 ? '이번 주 첫 할 일을 시작해 볼까요?'
    : `이번 주 ${done}개 완료!`;
  const sub = total === 0 ? '' : `${total}개 중 ${done}개를 마쳤어요.${done < total ? ' 오늘 하나만 더 이어 볼까요?' : ''}`;

  const now = new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const iso = isoOf(day);
    const isToday = iso === isoOf(now);
    const isDone = s.tasks.some((t) => t.status === 'done' && t.due_date === iso);
    return `<div class="week-day">
      <span class="week-dot${isDone ? ' is-done' : ''}${isToday ? ' is-today' : ''}">${isDone ? icon('check', 16) : ''}</span>
      <span class="dl${isToday ? ' is-today' : ''}">${isToday ? '오늘' : WEEKDAYS[day.getDay()]}</span>
    </div>`;
  }).join('');

  els.banner.innerHTML = `<span class="banner-ic" aria-hidden="true">${icon('star', 26)}</span>
    <div class="banner-text"><span class="banner-title">${title}</span><span class="banner-sub">${sub}</span></div>
    <div class="week-dots">${days}</div>`;
}

// ── 상태 변경 ───────────────────────────────────────
function lowestPlan(taskId, s) {
  return s.links
    .filter((l) => l.task_id === taskId)
    .map((l) => s.plans.find((p) => p.id === l.plan_id))
    .filter(Boolean)
    .sort((a, b) => LEVEL_RANK[levelOf(a)] - LEVEL_RANK[levelOf(b)])[0];
}

// 마우스·터치·키보드 모두 이 함수를 지납니다. 화면은 먼저 바뀌고(낙관적), 저장이 실패하면 원래 열로 돌아갑니다.
// 링크 뷰(link.js)의 상태 트레이도 이 함수를 그대로 씁니다(같은 규칙, 같은 토스트 문구).
export async function moveTask(taskId, status) {
  const before = getState();
  const task = before.tasks.find((t) => t.id === taskId);
  const plan = task && lowestPlan(taskId, before);
  const pctBefore = plan && planProgress(plan.id, before).pct;
  try {
    if (!(await setTaskStatus(taskId, status))) return;
    const after = getState();
    let message = `${task.title}: ${TO_LABEL[status]} 옮겼어요.`;
    const pctAfter = plan && planProgress(plan.id, after).pct;
    if (plan && pctBefore !== pctAfter) message += ` ${LEVELS[levelOf(plan)].label} ${pctBefore ?? 0}% → ${pctAfter}%`;
    showToast(message);
  } catch (err) {
    console.error(err);
    showToast('저장하지 못해서 원래 열로 되돌렸어요. 잠시 후 다시 시도해 주세요.');
  }
}

// ── 미완료 이월(P1-3) ────────────────────────────────
// 대상: 지금 보고 있는 주의 수행일이 있고 완료하지 않은 할 일. 수행일만 7일 뒤로 옮기고 계획 연결은
// 그대로 둡니다(진행률은 연결 기준이라 영향이 없고, 다음 주 보드에는 수행일 기준으로 자연히 나타납니다).
function eligibleForCarryOver(s) {
  if (getPeriod() !== 'week') return [];
  const range = rangeOf('week', getAnchor());
  const start = isoOf(range.start), end = isoOf(range.end);
  return s.tasks.filter((t) => t.status !== 'done' && t.due_date && t.due_date >= start && t.due_date <= end);
}

function renderCarryoverBar(s) {
  if (!els.carryoverBar) return;
  const eligible = eligibleForCarryOver(s);
  els.carryoverBar.hidden = eligible.length === 0;
  els.carryoverBar.innerHTML = eligible.length === 0 ? '' : `
    <span class="carryover-text">${icon('sparkles', 15)}이번 주 미완료 ${eligible.length}개</span>
    <button type="button" class="btn btn-sm btn-outline" data-carryover>${icon('chevs-r', 14)}다음 주로 이월</button>`;
}

function confirmCarryOver() {
  const eligible = eligibleForCarryOver(getState());
  if (!eligible.length) return;
  const back = openModal(`<div class="auth-card" role="alertdialog" aria-modal="true" aria-label="미완료 이월">
    <div class="auth-status-title">이번 주 미완료 ${eligible.length}개를 다음 주로 옮길까요?</div>
    <p class="auth-status-text">수행일이 7일 뒤로 바뀌어서 다음 주 보드에 나타나요. 계획 연결과 진행률에는 영향이 없어요.</p>
    <div class="auth-status-actions">
      <button type="button" class="btn btn-outline" id="carryover-cancel">취소</button>
      <button type="button" class="btn btn-primary" id="carryover-confirm">이월하기</button>
    </div>
  </div>`, '#carryover-cancel');
  back.querySelector('#carryover-cancel').addEventListener('click', closeModal);
  back.querySelector('#carryover-confirm').addEventListener('click', async () => {
    try {
      const count = eligible.length;
      await carryOverTasks(eligible.map((t) => t.id));
      closeModal();
      showToast(`${count}개를 다음 주로 옮겼어요.`);
    } catch (err) {
      showToast(err.message);
    }
  });
}

// ── 키보드 대안: 카드에서 Enter → 상태 변경 메뉴 ─────
// 링크 뷰의 할 일 노드도 같은 메뉴를 씁니다(openStatusMenu export).
export function closeStatusMenu(returnFocusTo) {
  if (!openMenu) return;
  const { menu, onOutside } = openMenu;
  document.removeEventListener('pointerdown', onOutside, true);
  menu.remove();
  openMenu = null;
  returnFocusTo?.focus();
}

export function openStatusMenu(card) {
  closeStatusMenu();
  const task = getState().tasks.find((t) => t.id === card.dataset.taskId);
  if (!task) return;
  const menu = document.createElement('div');
  menu.className = 'status-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', '상태 변경');
  menu.innerHTML = `<div class="status-menu-title">상태 변경</div>` + STATUS_KEYS.map((st) => `
    <button type="button" class="status-menu-item" role="menuitemradio" data-status="${st}" aria-checked="${st === task.status}">
      <span class="status-ic">${icon(STATUSES[st].icon, 18)}</span><span class="status-name">${STATUSES[st].label}</span>
      <span class="status-check">${icon('check', 16)}</span>
    </button>`).join('');
  document.body.appendChild(menu);

  // 카드 아래(공간이 모자라면 위)에 놓습니다.
  const rect = card.getBoundingClientRect();
  const height = menu.offsetHeight;
  const top = rect.bottom + 6 + height > window.innerHeight ? Math.max(8, rect.top - 6 - height) : rect.bottom + 6;
  menu.style.top = `${top}px`;
  menu.style.left = `${Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8)}px`;

  const items = [...menu.querySelectorAll('.status-menu-item')];
  const onOutside = (e) => { if (!menu.contains(e.target)) closeStatusMenu(); };
  document.addEventListener('pointerdown', onOutside, true);
  openMenu = { menu, onOutside };

  menu.addEventListener('keydown', (e) => {
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeStatusMenu(card); }
    else if (e.key === 'Tab') { closeStatusMenu(); }
  });
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('.status-menu-item');
    if (!item) return;
    pendingFocus = task.id;
    closeStatusMenu();
    moveTask(task.id, item.dataset.status).then(() => { if (pendingFocus) { card.isConnected && card.focus(); pendingFocus = null; } });
  });
  (items.find((b) => b.getAttribute('aria-checked') === 'true') || items[0]).focus();
}

function render(s) {
  renderGoals(s);
  renderChain(s);
  renderColumns(s);
  renderBanner(s);
  renderCarryoverBar(s);
  const period = getPeriod();
  const { long, short } = labelOf(period, getAnchor());
  updatePeriodDisplay({ long, short, title: titleOf(period) });
}

// 600px 미만 전용 상태 탭(시작 전/진행 중/완료 한 열씩, DESIGN.md 9절). 탭 자체는 데이터와 무관해
// 한 번만 그리고, 선택 상태만 클릭 때마다 갱신합니다(열 전환은 순수 CSS 속성 선택자로 처리, view-board.css).
function renderStatusTabs(current) {
  els.statusTabs.innerHTML = STATUS_KEYS.map((st) => {
    const { icon: iconId, label } = STATUSES[st];
    return `<button type="button" class="status-tab" data-status-tab="${st}" role="tab" aria-selected="${st === current}">${icon(iconId, 16)}<span>${label}</span></button>`;
  }).join('');
}

export function mountBoard() {
  els = {
    goalList: document.getElementById('goal-list'),
    soloRow: document.getElementById('solo-row'),
    soloCount: document.getElementById('solo-count'),
    chain: document.getElementById('chain'),
    board: document.getElementById('board'),
    banner: document.getElementById('banner'),
    statusTabs: document.getElementById('status-tabs'),
    carryoverBar: document.getElementById('carryover-bar'),
  };
  renderStatusTabs(document.documentElement.dataset.mobileStatus || 'todo');

  document.addEventListener('click', (e) => {
    const planBtn = e.target.closest('[data-filter-plan]');
    if (planBtn) return setScope({ type: 'plan', id: planBtn.dataset.filterPlan });
    if (e.target.closest('[data-filter-solo]')) return setScope({ type: 'solo', id: null });
    if (e.target.closest('[data-carryover]')) return confirmCarryOver();

    if (e.target.closest('[data-task-add]')) return openTaskModal();
    const taskEdit = e.target.closest('[data-task-edit]');
    if (taskEdit) return openTaskModal(getState().tasks.find((t) => t.id === taskEdit.dataset.taskEdit));
    const taskDelete = e.target.closest('[data-task-delete]');
    if (taskDelete) { const t = getState().tasks.find((x) => x.id === taskDelete.dataset.taskDelete); if (t) confirmDeleteTask(t); return; }
    const taskFav = e.target.closest('[data-task-favorite]');
    if (taskFav) {
      const t = getState().tasks.find((x) => x.id === taskFav.dataset.taskFavorite);
      if (t) updateTask(t.id, { is_favorite: !t.is_favorite }).catch((err) => showToast(err.message));
      return;
    }

    const statusTab = e.target.closest('[data-status-tab]');
    if (statusTab) {
      document.documentElement.dataset.mobileStatus = statusTab.dataset.statusTab;
      els.statusTabs.querySelectorAll('[data-status-tab]').forEach((b) => b.setAttribute('aria-selected', String(b === statusTab)));
      return;
    }

    if (e.target.closest('[data-plan-add-year]')) return openPlanModal(null, { planType: 'yearly', anchor: getAnchor() });
    const planEdit = e.target.closest('[data-plan-edit]');
    if (planEdit) { const p = getState().plans.find((x) => x.id === planEdit.dataset.planEdit); if (p) openPlanModal(p); return; }
    const planCreate = e.target.closest('[data-plan-create]');
    if (planCreate) return openPlanModal(null, { planType: planCreate.dataset.planCreate, anchor: getAnchor() });
  });

  els.board.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('task-card')) {
      e.preventDefault();
      openStatusMenu(e.target);
    }
  });

  // 기간 이동·전환은 shell.js 가 'linkplan:change' 를 쏘아 줍니다(테마·뷰 전환과 같은 채널).
  document.addEventListener('linkplan:change', () => { if (getState().ready) render(getState()); });

  subscribe(render);
  subscribeFilter(() => { if (getState().ready) render(getState()); });
  render(getState());
}
