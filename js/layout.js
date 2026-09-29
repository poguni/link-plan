// 링크 뷰 좌표 계산 (DOM 없는 순수 함수, DESIGN.md 6-2 기준).
// 부모 노드는 자식 노드들의 세로 중앙에 맞춥니다. 형제 사이 간격은 8px, 그룹(같은 주간에 속한 할 일들끼리,
// 또는 서로 다른 주간 그룹 사이) 간격은 24px 입니다. 열 x 좌표는 호출하는 쪽(link.js)이 tokens.css 값으로 넘깁니다.

export const TASK_H = 56, WEEK_H = 84, MONTH_H = 84, YEAR_H = 104;
export const SIB_GAP = 8, GROUP_GAP = 24;
export const TASK_TOP0 = 110;
export const SOLO_HEADER_Y = 606, SOLO_NODE_Y = 632;
export const TRAY_Y = 632, TRAY_H = 164;

const byId = (plans) => new Map(plans.map((p) => [p.id, p]));
const bottom = (pos) => pos.top + pos.height;
const centerOf = (positions) => {
  const tops = positions.map((p) => p.top);
  const bottoms = positions.map(bottom);
  const min = Math.min(...tops), max = Math.max(...bottoms);
  return (min + max) / 2;
};

// PRD 5-3 의 check_plan_parent 와 같은 규칙: 주간→월간, 월간→연간만 허용. 하위 계획이 있으면 자기 자신·자손을
// 새 상위로 고를 수 없습니다(순환 방지). 서버 검증(Phase 6)이 기준이고, 이 함수는 화면에서 미리 걸러 토스트로 보여줄 때 씁니다.
export function checkPlanParent(plan, newParentId, plans) {
  if (newParentId === null) return { ok: true };
  if (newParentId === plan.id) return { ok: false, reason: '계획을 자기 자신에 연결할 수 없어요.' };
  const parent = plans.find((p) => p.id === newParentId);
  if (!parent) return { ok: false, reason: '상위 계획을 찾을 수 없어요.' };
  const allow = (plan.plan_type === 'weekly' && parent.plan_type === 'monthly')
    || (plan.plan_type === 'monthly' && parent.plan_type === 'yearly');
  if (!allow) return { ok: false, reason: '주간은 월간에, 월간은 연간에만 연결할 수 있어요.' };
  // 순환 검사: newParentId 로부터 위로 올라가며 plan.id 를 다시 만나면 순환입니다.
  const parents = byId(plans);
  let cursor = parent;
  while (cursor) {
    if (cursor.id === plan.id) return { ok: false, reason: '순환 연결은 만들 수 없어요.' };
    cursor = cursor.parent_id ? parents.get(cursor.parent_id) : null;
  }
  return { ok: true };
}

export function computeLayout({ plans, tasks, links, columns, pastelOffset = false }) {
  const off = pastelOffset ? 12 : 0;
  const { x0, width } = columns;   // x0: [연간, 월간, 주간, 할일] x좌표, width: 노드 폭(모든 열 공통)
  const linkedTaskIds = new Set(links.map((l) => l.task_id));
  const planOf = (id) => plans.find((p) => p.id === id);
  const linksOfTask = (taskId) => links.filter((l) => l.task_id === taskId).map((l) => planOf(l.plan_id)).filter(Boolean);

  // ── 1) 연결된 할 일: 원래 순서대로, 같은 주간에 속하면 8px, 다른 주간 그룹으로 넘어가면 24px 간격 ──
  const connectedTasks = tasks.filter((t) => linkedTaskIds.has(t.id));
  const soloTasks = tasks.filter((t) => !linkedTaskIds.has(t.id));
  const taskPos = new Map();
  let prevWeekId = null;
  let cursor = TASK_TOP0;
  connectedTasks.forEach((task, i) => {
    const weekId = linksOfTask(task.id).find((p) => p.plan_type === 'weekly')?.id ?? null;
    if (i > 0) cursor += TASK_H + (weekId && prevWeekId && weekId !== prevWeekId ? GROUP_GAP : SIB_GAP);
    taskPos.set(task.id, { id: task.id, kind: 'task', top: cursor + off, height: TASK_H, x: x0[3], width, weekId });
    prevWeekId = weekId;
  });
  // 연결된 할 일이 많아 고정된 SOLO_HEADER_Y(606)보다 아래로 내려가면 "연결 없음" 머리글이 마지막 카드와
  // 겹칩니다. 연결된 할 일 목록의 실제 끝 지점을 기준으로 아래로 밀어냅니다(짧을 때는 기존 고정값 그대로).
  const connectedBottom = connectedTasks.length ? cursor + off + TASK_H : null;
  const soloHeaderY = connectedBottom !== null ? Math.max(SOLO_HEADER_Y + off, connectedBottom + GROUP_GAP) : SOLO_HEADER_Y + off;
  const soloNodeY = soloHeaderY + (SOLO_NODE_Y - SOLO_HEADER_Y);
  soloTasks.forEach((task, i) => {
    const top = soloNodeY + i * (TASK_H + SIB_GAP);
    taskPos.set(task.id, { id: task.id, kind: 'task', top, height: TASK_H, x: x0[3], width, weekId: null });
  });

  // ── 2) 주간: 자신에게 연결된 할 일들의 세로 중앙에 맞춥니다 ──
  const weekPos = new Map();
  let lastWeekBottom = null;
  plans.filter((p) => p.plan_type === 'weekly').forEach((week) => {
    const children = connectedTasks.filter((t) => taskPos.get(t.id).weekId === week.id).map((t) => taskPos.get(t.id));
    const center = children.length ? centerOf(children) : (lastWeekBottom ?? TASK_TOP0) + off + GROUP_GAP + WEEK_H / 2;
    const top = center - WEEK_H / 2;
    weekPos.set(week.id, { id: week.id, kind: 'week', top, height: WEEK_H, x: x0[2], width });
    lastWeekBottom = top - off + WEEK_H;
  });

  // ── 3) 월간: 하위 주간들의 범위 ∪ (주간 없이) 직접 연결된 할 일들의 범위에 맞춥니다 ──
  const monthPos = new Map();
  let lastMonthBottom = null;
  plans.filter((p) => p.plan_type === 'monthly').forEach((month) => {
    const weekChildren = plans.filter((p) => p.plan_type === 'weekly' && p.parent_id === month.id).map((w) => weekPos.get(w.id));
    const directTasks = connectedTasks
      .filter((t) => !taskPos.get(t.id).weekId && linksOfTask(t.id).some((p) => p.id === month.id))
      .map((t) => taskPos.get(t.id));
    const children = [...weekChildren, ...directTasks].filter(Boolean);
    const center = children.length ? centerOf(children) : (lastMonthBottom ?? TASK_TOP0) + off + GROUP_GAP + MONTH_H / 2;
    const top = center - MONTH_H / 2;
    monthPos.set(month.id, { id: month.id, kind: 'month', top, height: MONTH_H, x: x0[1], width });
    lastMonthBottom = top - off + MONTH_H;
  });

  // ── 4) 연간: 하위 월간들의 범위에만 맞춥니다(직접 연결된 할 일은 시안 기준으로 영향을 주지 않음) ──
  const yearPos = new Map();
  let lastYearBottom = null;
  // 드래그로 순서를 바꾼 직후에도(sort_order 값만 바뀌고 배열 순서는 그대로) 바로 반영되도록 정렬해서 돕니다.
  plans.filter((p) => p.plan_type === 'yearly').sort((a, b) => a.sort_order - b.sort_order).forEach((year) => {
    const children = plans.filter((p) => p.plan_type === 'monthly' && p.parent_id === year.id).map((m) => monthPos.get(m.id)).filter(Boolean);
    const center = children.length ? centerOf(children) : (lastYearBottom ?? TASK_TOP0) + off + GROUP_GAP + YEAR_H / 2;
    const top = center - YEAR_H / 2;
    yearPos.set(year.id, { id: year.id, kind: 'year', top, height: YEAR_H, x: x0[0], width });
    lastYearBottom = top - off + YEAR_H;
  });

  const nodes = [...yearPos.values(), ...monthPos.values(), ...weekPos.values(), ...taskPos.values()];
  const graphBottom = Math.max(soloNodeY + soloTasks.length * (TASK_H + SIB_GAP), ...nodes.map(bottom));
  return { nodes, byId: new Map(nodes.map((n) => [n.id, n])), soloHeaderY, graphBottom };
}
