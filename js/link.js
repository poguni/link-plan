// 링크 뷰: 연간→월간→주간→할 일 노드 그래프, SVG 연결선, 상태 트레이.
// 좌표 계산은 layout.js(DOM 없는 순수 함수)가 하고, 이 파일은 그 결과를 DOM/SVG 로 그리고 상호작용을 답니다.
import { icon } from './icons.js';
import { chip, esc, progressRing, showToast, LEVELS, STATUSES } from './ui.js';
import { getState, subscribe, addLink, removeLink } from './state.js';
import { moveTask, openStatusMenu, closeStatusMenu } from './board.js';
import { computeLayout, checkPlanParent } from './layout.js';
import { planProgress } from './progress.js';
import { openPlanModal } from './planmodal.js';
import { getAnchor } from './period.js';

const CHILD_TYPE = { yearly: 'monthly', monthly: 'weekly', weekly: null };

const LEVEL_OF = { yearly: 'year', monthly: 'month', weekly: 'week' };
const HEADER_Y = 40, HEADER_H = 30;
const DOT_TOUCH = 22;   // 점의 시각 지름은 ~10px 이지만 터치 영역은 넉넉하게(PRD 6-6: 44px 이상 권장, 여백으로 확보)
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

let els = {};
let layout = null;
let edgeDelete = null;   // 열려 있는 「연결선 삭제」 팝오버
let dragPreview = null;  // 트레이 드래그 중 보여줄 미리보기 요소

const pad = (n) => String(n).padStart(2, '0');
const shortDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); const dt = new Date(y, m - 1, d); return `${m}/${d} (${WEEKDAYS[dt.getDay()]})`; };

function readColumns() {
  const style = getComputedStyle(document.documentElement);
  const num = (name) => parseFloat(style.getPropertyValue(name));
  const x0 = num('--node-x0'), pitch = num('--node-pitch'), width = num('--node-w');
  return { x0: [0, 1, 2, 3].map((i) => x0 + i * pitch), width };
}

// ── 노드 내용 ────────────────────────────────────────
function planNodeHtml(plan, pos, s) {
  const level = LEVEL_OF[plan.plan_type];
  const pr = planProgress(plan.id, s);
  const pct = pr.pct ?? 0;
  const achieved = plan.plan_type === 'weekly' && pr.pct === 100;
  const label = achieved ? `${LEVELS[level].label} 계획 · 달성` : `${LEVELS[level].label} 계획`;
  const ariaLabel = `${LEVELS[level].label} 계획, ${plan.title}, ${pr.pct === null ? '측정 전' : `${pr.pct}%`}`;
  const childType = CHILD_TYPE[plan.plan_type];
  return `<div class="lnode lnode--plan lnode--${level}" data-plan-id="${esc(plan.id)}" data-kind="${plan.plan_type}"
      style="left:${pos.x}px;top:${pos.top}px;width:${pos.width}px;height:${pos.height}px"
      tabindex="0" role="group" aria-label="${esc(ariaLabel)}">
    <div class="lnode-info">
      <div class="lnode-label">${icon(LEVELS[level].icon, 13)}<span>${label}</span>
        <span class="lnode-actions">
          <button type="button" class="icon-btn" data-plan-edit="${esc(plan.id)}" aria-label="수정">${icon('pencil', 12)}</button>
          ${childType ? `<button type="button" class="icon-btn" data-plan-create="${childType}" data-plan-create-parent="${esc(plan.id)}" aria-label="하위 계획 추가">${icon('plus', 12)}</button>` : ''}
        </span>
      </div>
      <div class="lnode-title">${esc(plan.title)}</div>
      <div class="lnode-count">${pr.total === 0 ? '측정 전' : `${pr.done}/${pr.total} 완료`}</div>
    </div>
    ${progressRing(pct, level, ariaLabel)}
    ${level !== 'year' ? `<span class="dot dot-left" aria-hidden="true"></span>` : ''}
    <span class="dot dot-right" data-handle="out" aria-hidden="true"></span>
  </div>`;
}

function taskNodeHtml(task, pos, s) {
  const linkCount = s.links.filter((l) => l.task_id === task.id).length;
  const badge = linkCount >= 2 ? `<span class="lnode-badge">${icon('link', 12)}${linkCount}</span>` : '';
  const sub = task.status === 'done'
    ? (task.due_date ? `${shortDate(task.due_date)} 완료` : '완료')
    : (task.due_date ? shortDate(task.due_date) : '기한 없음');
  const ariaLabel = `할 일, ${task.title}, ${STATUSES[task.status].label}`;
  return `<div class="lnode lnode--task" data-task-id="${esc(task.id)}" data-status="${task.status}"
      style="left:${pos.x}px;top:${pos.top}px;width:${pos.width}px;height:${pos.height}px"
      tabindex="0" role="group" aria-label="${esc(ariaLabel)}" aria-keyshortcuts="Enter">
    <span class="dot dot-left" data-handle="in" aria-hidden="true"></span>
    <span class="lstatus-ic">${icon(STATUSES[task.status].icon, 18)}</span>
    <div class="ltask-text"><span class="ltask-title">${esc(task.title)}</span><span class="ltask-sub">${sub}</span></div>
    ${badge}
    <span class="grip" aria-hidden="true">${icon('grip', 15)}</span>
  </div>`;
}

function headerHtml(x, width, iconId, label, count) {
  return `<div class="lhead" style="left:${x}px;top:${HEADER_Y}px;width:${width}px;height:${HEADER_H}px">${icon(iconId, 14)}<span>${esc(label)} · ${count}</span></div>`;
}

// ── 연결선 ──────────────────────────────────────────
// 두 점을 잇는 경로. y 가 같으면 직선, 다르면 3차 베지어(g=(x2-x1)/2). 월간→할일 직접 연결도 같은 공식을 씁니다(DESIGN 6-3).
function bezierPath(x1, y1, x2, y2) {
  if (y1 === y2) return `M ${x1} ${y1} H ${x2}`;
  const g = (x2 - x1) / 2;
  return `M ${x1} ${y1} C ${x1 + g} ${y1}, ${x2 - g} ${y2}, ${x2} ${y2}`;
}

// 연간→할일 직접 연결: 점선 직각 경로, 모서리 반지름 16px. 노드들 위쪽 여백을 돌아 연간 오른쪽 점으로 들어갑니다.
function orthogonalPath(x1, y1, x2, y2, railX, r = 16) {
  const sign = Math.sign(y2 - y1) || 1;
  return `M ${x1} ${y1} H ${railX + r} Q ${railX} ${y1} ${railX} ${y1 + r * sign} V ${y2 - r * sign} Q ${railX} ${y2} ${railX - r} ${y2} H ${x2}`;
}

function rightPoint(pos) { return { x: pos.x + pos.width, y: pos.top + pos.height / 2 }; }
function leftPoint(pos) { return { x: pos.x, y: pos.top + pos.height / 2 }; }

// 그릴 선 목록을 만듭니다: (a) 계획 트리 간선(부모→자식, 부모 색), (b) 할일-계획 연결(주간은 주간 색, 월간·연간 직접은 --line-direct).
// 모든 선에 양 끝 노드의 id(nodeA·nodeB)를 넣어 둡니다. 호버·포커스 강조가 이 값으로 "이 노드에 이어진 선"을 찾습니다.
// 지울 수 있는 선(할일-계획 연결)에는 taskId·planId 도 함께 넣어 클릭 삭제에 씁니다(계획 트리 간선은 지울 수 없음).
function buildEdges(s, byId) {
  const edges = [];
  s.plans.forEach((plan) => {
    if (!plan.parent_id) return;
    const parent = s.plans.find((p) => p.id === plan.parent_id);
    if (!parent) return;
    edges.push({ kind: 'tree', from: byId.get(parent.id), to: byId.get(plan.id), level: LEVEL_OF[parent.plan_type], nodeA: parent.id, nodeB: plan.id });
  });
  s.links.forEach((l) => {
    const plan = s.plans.find((p) => p.id === l.plan_id);
    const taskPos = byId.get(l.task_id);
    const planPos = byId.get(l.plan_id);
    if (!plan || !taskPos || !planPos) return;
    const base = { from: planPos, to: taskPos, nodeA: l.plan_id, nodeB: l.task_id, taskId: l.task_id, planId: l.plan_id };
    if (plan.plan_type === 'weekly') edges.push({ ...base, kind: 'week', level: 'week' });
    else if (plan.plan_type === 'monthly') edges.push({ ...base, kind: 'direct-solid' });
    else edges.push({ ...base, kind: 'direct-dashed' });
  });
  return edges;
}

function edgeSvg(edge, columns) {
  const a = rightPoint(edge.from), b = leftPoint(edge.to);
  const cls = `edge edge--${edge.kind}${edge.level ? ` edge--${edge.level}` : ''}`;
  const d = edge.kind === 'direct-dashed' ? orthogonalPath(b.x, b.y, a.x, a.y, columns.x0[0] + columns.width + 16) : bezierPath(a.x, a.y, b.x, b.y);
  const nodeAttrs = ` data-node-a="${esc(edge.nodeA)}" data-node-b="${esc(edge.nodeB)}"`;
  const delAttrs = edge.taskId ? ` data-task-id="${esc(edge.taskId)}" data-plan-id="${esc(edge.planId)}"` : '';
  const hit = edge.taskId ? `<path class="edge-hit" d="${d}"${delAttrs}></path>` : '';
  const dotFrom = `<circle class="edge-dot" cx="${a.x}" cy="${a.y}" r="var(--dot-r)"/>`;
  const dotTo = `<circle class="edge-dot" cx="${b.x}" cy="${b.y}" r="var(--dot-r)"/>`;
  return `<path class="${cls}" d="${d}"${nodeAttrs}></path>${hit}${dotFrom}${dotTo}`;
}

// ── 상태 트레이 ─────────────────────────────────────
function trayCellHtml(status, tasks) {
  const { icon: iconId, label } = STATUSES[status];
  const hint = { todo: '끌어다 놓아 되돌리기', doing: '지금 손대고 있는 일', done: '여기에 놓으면 완료' }[status];
  return `<div class="tray-cell" data-tray-status="${status}">
    <div class="tray-cell-head">
      <span class="tray-ic">${icon(iconId, 18)}</span><span class="tray-name">${label}</span>
      <span class="tray-count num">${tasks.length}</span>
    </div>
    <div class="tray-drop"><span class="tray-hint-text">${hint}</span></div>
  </div>`;
}

function renderTray(s) {
  const groups = { todo: [], doing: [], done: [] };
  s.tasks.forEach((t) => groups[t.status]?.push(t));
  els.tray.innerHTML = Object.entries(groups).map(([status, tasks]) => trayCellHtml(status, tasks)).join('');
}

// ── 전체 렌더 ────────────────────────────────────────
function render(s) {
  closeStatusMenu();
  closeEdgeDelete();
  const columns = readColumns();
  layout = computeLayout({ plans: s.plans, tasks: s.tasks, links: s.links, columns, pastelOffset: document.documentElement.dataset.theme === 'pastel' });
  const byId = layout.byId;

  const graphWidth = columns.x0[3] + columns.width + 40;
  const graphHeight = layout.graphBottom + 32;
  els.graph.style.setProperty('--graph-w', `${graphWidth}px`);
  els.graph.style.setProperty('--graph-h', `${graphHeight}px`);

  const solo = s.tasks.filter((t) => !s.links.some((l) => l.task_id === t.id));
  const linkedCount = s.tasks.length - solo.length;
  const headers = [
    headerHtml(columns.x0[0], columns.width, 'flag', '연간 목표', s.plans.filter((p) => p.plan_type === 'yearly').length),
    headerHtml(columns.x0[1], columns.width, 'calendar', '월간 계획', s.plans.filter((p) => p.plan_type === 'monthly').length),
    headerHtml(columns.x0[2], columns.width, 'calendar-days', '주간 계획', s.plans.filter((p) => p.plan_type === 'weekly').length),
    headerHtml(columns.x0[3], columns.width, 'link', '연결된 할 일', linkedCount),
  ].join('');

  const nodes = s.plans.map((p) => planNodeHtml(p, byId.get(p.id), s)).join('')
    + s.tasks.map((t) => taskNodeHtml(t, byId.get(t.id), s)).join('');

  const soloHtml = `<div class="lsolo-head" style="left:${columns.x0[3]}px;top:${layout.soloHeaderY}px;width:${columns.width}px">
      ${icon('unlink', 14)}<span>연결 없음 · 독립 할 일</span></div>`;

  els.nodes.innerHTML = headers + nodes + soloHtml;
  els.svg.innerHTML = buildEdges(s, byId).map((e) => edgeSvg(e, columns)).join('');
  els.svg.setAttribute('width', graphWidth);
  els.svg.setAttribute('height', graphHeight);

  renderTray(s);
}

// ── 상호작용: 호버·포커스로 관련 선만 강조(나머지는 옅게, DESIGN 6-6) ─
function highlight(node) {
  const id = node.dataset.planId ?? node.dataset.taskId;
  if (!id) return;
  els.svg.querySelectorAll('path.edge').forEach((p) => {
    const related = p.dataset.nodeA === id || p.dataset.nodeB === id;
    p.classList.toggle('is-active', related);
    p.classList.toggle('is-dim', !related);
  });
}
function clearHighlight() {
  els.svg.querySelectorAll('path.edge').forEach((p) => p.classList.remove('is-active', 'is-dim'));
}

// ── 상호작용: 연결선 클릭 → 삭제 버튼 ────────────────
function closeEdgeDelete() {
  edgeDelete?.remove();
  edgeDelete = null;
}
function openEdgeDelete(hitPath, x, y) {
  closeEdgeDelete();
  const { taskId, planId } = hitPath.dataset;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'edge-delete';
  btn.style.left = `${x}px`;
  btn.style.top = `${y}px`;
  btn.innerHTML = icon('x', 14);
  btn.setAttribute('aria-label', '연결 삭제');
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeEdgeDelete();
    try { await removeLink(taskId, planId); showToast('연결을 지웠어요. 이제 독립 할 일일 수 있어요.'); }
    catch { showToast('연결을 지우지 못했어요. 잠시 후 다시 시도해 주세요.'); }
  });
  els.graph.appendChild(btn);
  edgeDelete = btn;
}

// ── 상호작용: 할 일을 트레이로 끌어 상태 변경 ────────
function startTaskDrag(node, pointerId) {
  const taskId = node.dataset.taskId;
  node.setPointerCapture(pointerId);
  node.classList.add('is-dragging');

  const onMove = (e) => {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const cell = under?.closest('.tray-cell');
    els.tray.querySelectorAll('.tray-cell').forEach((c) => c.classList.toggle('is-drop-target', c === cell));
    if (cell?.dataset.trayStatus === 'done') showDonePreview(taskId); else hideDonePreview();
  };
  const onUp = async (e) => {
    node.removeEventListener('pointermove', onMove);
    node.removeEventListener('pointerup', onUp);
    node.classList.remove('is-dragging');
    els.tray.querySelectorAll('.tray-cell').forEach((c) => c.classList.remove('is-drop-target'));
    hideDonePreview();
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const cell = under?.closest('.tray-cell');
    if (cell) await moveTask(taskId, cell.dataset.trayStatus);
  };
  node.addEventListener('pointermove', onMove);
  node.addEventListener('pointerup', onUp, { once: true });
}

// 완료 칸의 「주간 33% → 67%」 미리보기 칩(DESIGN 6-5). 실제로 상태를 바꾸지 않고 계산만 미리 해 봅니다.
function showDonePreview(taskId) {
  const s = getState();
  const plan = s.links.filter((l) => l.task_id === taskId).map((l) => s.plans.find((p) => p.id === l.plan_id))
    .filter(Boolean).find((p) => p.plan_type === 'weekly')
    ?? s.links.filter((l) => l.task_id === taskId).map((l) => s.plans.find((p) => p.id === l.plan_id)).filter(Boolean)[0];
  const cell = els.tray.querySelector('[data-tray-status="done"]');
  if (!plan || !cell) return hideDonePreview();
  const before = planProgress(plan.id, s);
  const already = s.tasks.find((t) => t.id === taskId)?.status === 'done';
  const doneDelta = already ? 0 : 1;
  const after = before.total === 0 ? before.pct : Math.round(((before.done + doneDelta) / before.total) * 100);
  let chip = cell.querySelector('.tray-preview');
  if (!chip) { chip = document.createElement('span'); chip.className = 'tray-preview'; cell.appendChild(chip); }
  chip.textContent = `${LEVELS[LEVEL_OF[plan.plan_type]].label} ${before.pct ?? 0}% → ${after ?? 0}%`;
}
function hideDonePreview() { els.tray.querySelector('.tray-preview')?.remove(); }

// ── 상호작용: 할 일의 왼쪽 점을 끌어 다른 계획에 연결 ─
function startLinkDrag(dot, pointerId, taskId) {
  dot.setPointerCapture(pointerId);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('class', 'edge-draft');
  els.svg.appendChild(line);
  const start = leftPoint(layout.byId.get(taskId));
  line.setAttribute('x1', start.x); line.setAttribute('y1', start.y);
  line.setAttribute('x2', start.x); line.setAttribute('y2', start.y);

  const graphBox = () => els.graph.getBoundingClientRect();
  const onMove = (e) => {
    const box = graphBox();
    line.setAttribute('x2', e.clientX - box.left + els.graph.scrollLeft);
    line.setAttribute('y2', e.clientY - box.top + els.graph.scrollTop);
    const under = document.elementFromPoint(e.clientX, e.clientY);
    els.nodes.querySelectorAll('.lnode--plan.is-link-target').forEach((n) => n.classList.remove('is-link-target'));
    under?.closest('.lnode--plan')?.classList.add('is-link-target');
  };
  const onUp = async (e) => {
    dot.removeEventListener('pointermove', onMove);
    dot.removeEventListener('pointerup', onUp);
    line.remove();
    els.nodes.querySelectorAll('.lnode--plan.is-link-target').forEach((n) => n.classList.remove('is-link-target'));
    const under = document.elementFromPoint(e.clientX, e.clientY);
    const planNode = under?.closest('.lnode--plan');
    if (!planNode) return;
    try {
      const added = await addLink(taskId, planNode.dataset.planId);
      if (added) showToast('새로 연결했어요.');
    } catch { showToast('연결하지 못했어요. 잠시 후 다시 시도해 주세요.'); }
  };
  dot.addEventListener('pointermove', onMove);
  dot.addEventListener('pointerup', onUp, { once: true });
}

// ── 연결선 재계산(리사이즈 후에도 노드 점과 선이 맞도록) ─
function relayout() { if (getState().ready) render(getState()); }
function bindResize() {
  let raf = null;
  const onResize = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = null; relayout(); }); };
  window.addEventListener('resize', onResize);
  new ResizeObserver(onResize).observe(els.graph);
}

export function mountLink() {
  els = {
    graph: document.getElementById('link-graph'),
    svg: document.getElementById('link-svg'),
    nodes: document.getElementById('link-nodes'),
    tray: document.getElementById('tray'),
  };

  els.nodes.addEventListener('pointerdown', (e) => {
    const dot = e.target.closest('.dot-left');
    const taskNode = e.target.closest('.lnode--task');
    if (dot && taskNode) return startLinkDrag(dot, e.pointerId, taskNode.dataset.taskId);
    if (taskNode && !e.target.closest('.icon-btn')) return startTaskDrag(taskNode, e.pointerId);
  });

  els.nodes.addEventListener('mouseover', (e) => { const n = e.target.closest('.lnode'); if (n) highlight(n); });
  els.nodes.addEventListener('mouseout', (e) => { if (!e.relatedTarget?.closest('.lnode')) clearHighlight(); });
  els.nodes.addEventListener('focusin', (e) => { const n = e.target.closest('.lnode'); if (n) highlight(n); });
  els.nodes.addEventListener('focusout', (e) => { if (!e.relatedTarget?.closest('.lnode')) clearHighlight(); });

  els.nodes.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('lnode--task')) { e.preventDefault(); openStatusMenu(e.target); }
  });

  els.nodes.addEventListener('click', (e) => {
    // board.js도 document 에서 같은 data-plan-* 속성을 듣고 있어(목표 패널·연결 사슬용), 여기서 처리했으면
    // document 까지 올라가 두 번 열리지 않도록 막습니다.
    const editBtn = e.target.closest('[data-plan-edit]');
    if (editBtn) { e.stopPropagation(); const p = getState().plans.find((x) => x.id === editBtn.dataset.planEdit); if (p) openPlanModal(p); return; }
    const createBtn = e.target.closest('[data-plan-create]');
    if (createBtn) { e.stopPropagation(); openPlanModal(null, { planType: createBtn.dataset.planCreate, parentId: createBtn.dataset.planCreateParent, anchor: getAnchor() }); }
  });

  els.svg.addEventListener('click', (e) => {
    const hit = e.target.closest('.edge-hit');
    if (!hit) return closeEdgeDelete();
    const box = els.graph.getBoundingClientRect();
    openEdgeDelete(hit, e.clientX - box.left + els.graph.scrollLeft, e.clientY - box.top + els.graph.scrollTop);
  });
  document.addEventListener('pointerdown', (e) => { if (edgeDelete && !e.target.closest('.edge-delete') && !e.target.closest('.edge-hit')) closeEdgeDelete(); });

  subscribe(() => { if (document.documentElement.dataset.view === 'link') render(getState()); });
  document.addEventListener('linkplan:change', () => { if (getState().ready && document.documentElement.dataset.view === 'link') relayout(); });
  bindResize();
  if (getState().ready) render(getState());
}
