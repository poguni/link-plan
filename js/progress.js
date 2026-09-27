// 진행률 계산 (PRD 「진행률 계산 규칙」).
//  1. 집계 대상: 계획에 직접 연결된 할 일 + 하위 계획(연간→월간→주간)에 연결된 할 일. 같은 할 일은 한 번만 셉니다.
//  2. 완료만 반영합니다. 시작 전·진행 중은 0 으로 셉니다.
//  3. 할 일이 없으면 0% 가 아니라 "측정 전"(pct 가 null)입니다.
//  4. 소수점 첫째 자리에서 반올림한 정수(%)입니다.
// 화면 표시는 Phase 6 에서 서버의 plan_progress 뷰를 쓰지만, 드래그 직후 미리 보여 주는 계산은 계속 이 파일을 씁니다.

// 계획 자신과 모든 하위 계획의 id (순환이 있어도 무한 반복하지 않습니다)
export function planTreeIds(planId, plans) {
  const seen = new Set([planId]);
  const queue = [planId];
  while (queue.length) {
    const current = queue.shift();
    for (const plan of plans) {
      if (plan.parent_id === current && !seen.has(plan.id)) {
        seen.add(plan.id);
        queue.push(plan.id);
      }
    }
  }
  return seen;
}

// 계획의 진행률에 들어가는 할 일 id (중복 제거)
export function planTaskIds(planId, plans, links) {
  const tree = planTreeIds(planId, plans);
  return new Set(links.filter((l) => tree.has(l.plan_id)).map((l) => l.task_id));
}

export function planProgress(planId, { plans, tasks, links }) {
  const ids = planTaskIds(planId, plans, links);
  const linked = tasks.filter((t) => ids.has(t.id));
  const total = linked.length;
  const done = linked.filter((t) => t.status === 'done').length;
  return { total, done, pct: total === 0 ? null : Math.round((done / total) * 100) };
}
