// 데이터 어댑터. 화면 코드는 이 파일의 함수만 부릅니다.
// 지금은 design/sample-data.json 을 읽는 "샘플 어댑터"입니다. Phase 6 에서 같은 함수 이름으로 Supabase 어댑터를 만들어 바꿔 끼웁니다.

// sample-data.json 은 원본을 고치지 않고, 읽을 때 PRD 5-3 의 데이터 모양(plan_type 이름, memo)으로 맞춥니다.
const PLAN_TYPE = { year: 'yearly', month: 'monthly', week: 'weekly' };

export async function loadAll() {
  const res = await fetch('design/sample-data.json');
  if (!res.ok) throw new Error('샘플 데이터를 불러오지 못했어요.');
  const raw = await res.json();
  return {
    // done·total·progress·count 는 표시용 예시값이라 버립니다. 진행률은 항상 규칙대로 계산합니다(progress.js).
    plans: raw.plans.map((p) => ({
      id: p.id,
      plan_type: PLAN_TYPE[p.plan_type] ?? p.plan_type,
      title: p.title,
      parent_id: p.parent_id,
    })),
    tasks: raw.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      memo: t.note ?? null,
      due_date: t.due_date ?? null,
      status: t.status,
      completed_at: null,
    })),
    links: raw.task_plan_links.map((l) => ({ task_id: l.task_id, plan_id: l.plan_id })),
  };
}

// 저장 실패 경로를 시험하기 위한 장치입니다. 콘솔에서 simulateWriteFailure() 를 부르면 다음 저장 한 번이 실패합니다.
let failNextWrite = false;
export function simulateWriteFailure() { failNextWrite = true; }

// 지금은 서버가 없어서 항상 성공합니다. Supabase 어댑터에서는 tasks 행을 갱신합니다.
export async function updateTaskStatus(taskId, status, completedAt) {
  if (failNextWrite) {
    failNextWrite = false;
    throw new Error('저장에 실패했어요(모의 실패).');
  }
}
