// 메모리 상태 저장소. 구독(변경 알림) 방식이고, 상태는 이 파일의 함수로만 바꿉니다.
// 화면은 getState() 로 읽고 subscribe() 로 변경을 받습니다. 상태 객체를 직접 고치지 않습니다(항상 새 객체로 교체).
import * as api from './api.js';

const STATUSES = ['todo', 'doing', 'done'];

let state = { plans: [], tasks: [], links: [], progress: {}, ready: false };
const listeners = new Set();

export function getState() { return state; }

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next) {
  state = next;
  listeners.forEach((fn) => fn(state));
}

// 진행률은 서버의 plan_progress 뷰가 기준입니다(PRD). 변경이 일어난 뒤 관련 계획들을 다시 조회해 맞춥니다.
// 화면은 그 사이에도 로컬 계산(progress.js)으로 즉시 미리보기를 보여 주므로 사용자는 지연을 느끼지 않습니다.
async function refreshProgress(planIds) {
  if (!planIds.length) return;
  try {
    const progress = await api.getProgress(planIds);
    commit({ ...state, progress: { ...state.progress, ...progress } });
  } catch (err) {
    console.error('진행률을 다시 불러오지 못했어요.', err);
  }
}

export async function loadState() {
  const data = await api.loadAll();
  commit({ ...state, ...data, ready: true });
  await refreshProgress(data.plans.map((p) => p.id));
}

// 낙관적 업데이트: 화면 상태를 먼저 바꾸고 저장합니다. 저장이 실패하면 그 할 일만 원래대로 되돌리고 오류를 다시 던집니다.
// 완료로 바꾸면 완료 시각을 기록하고, 다른 상태로 되돌리면 지웁니다(PRD P0-3, 실제 값은 서버 트리거가 다시 계산합니다).
// 반환값: 상태가 실제로 바뀌었으면 true.
export async function setTaskStatus(taskId, status) {
  if (!STATUSES.includes(status)) throw new Error(`알 수 없는 상태예요: ${status}`);
  const before = state.tasks.find((t) => t.id === taskId);
  if (!before || before.status === status) return false;

  const completedAt = status === 'done' ? new Date().toISOString() : null;
  const patch = (task) => (task.id === taskId ? { ...task, status, completed_at: completedAt } : task);
  commit({ ...state, tasks: state.tasks.map(patch) });

  try {
    await api.updateTaskStatus(taskId, status, completedAt);
    await refreshProgress(state.plans.map((p) => p.id));
    return true;
  } catch (err) {
    commit({ ...state, tasks: state.tasks.map((t) => (t.id === taskId ? before : t)) });
    throw err;
  }
}

// ── 할 일 만들기·수정·삭제(P0-1, P0-2) ──────────────
// 서버가 만들어 준 id 가 있어야 화면에 그릴 수 있어서, 만들기는 저장을 먼저 마친 뒤에 화면에 반영합니다
// (다른 낙관적 함수들과 달리 "먼저 보여주고 되돌리기"가 적용되지 않습니다).
export async function createTask({ title, memo, due_date, planIds = [] }) {
  const row = await api.createTask({ title, memo, due_date });
  const results = await Promise.allSettled(planIds.map((planId) => api.addLink(row.id, planId)));
  const linked = planIds.filter((_, i) => results[i].status === 'fulfilled');
  commit({ ...state, tasks: [...state.tasks, row], links: [...state.links, ...linked.map((planId) => ({ task_id: row.id, plan_id: planId }))] });
  await refreshProgress(state.plans.map((p) => p.id));
  if (results.some((r) => r.status === 'rejected')) throw new Error('할 일은 만들었지만 일부 연결에는 실패했어요.');
  return row;
}

export async function updateTask(taskId, patch) {
  const before = state.tasks.find((t) => t.id === taskId);
  if (!before) return;
  commit({ ...state, tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) });
  try {
    await api.updateTask(taskId, patch);
  } catch (err) {
    commit({ ...state, tasks: state.tasks.map((t) => (t.id === taskId ? before : t)) });
    throw err;
  }
}

// 할 일의 연결 집합을 통째로 바꿉니다(수정 모달의 체크리스트). 이전/다음 집합의 차이만 추가·삭제합니다.
export async function updateTaskLinks(taskId, nextPlanIds) {
  const before = state.links;
  const current = new Set(before.filter((l) => l.task_id === taskId).map((l) => l.plan_id));
  const next = new Set(nextPlanIds);
  const toAdd = [...next].filter((id) => !current.has(id));
  const toRemove = [...current].filter((id) => !next.has(id));
  if (!toAdd.length && !toRemove.length) return;

  commit({
    ...state,
    links: [
      ...before.filter((l) => l.task_id !== taskId || next.has(l.plan_id)),
      ...toAdd.map((planId) => ({ task_id: taskId, plan_id: planId })),
    ],
  });
  try {
    await Promise.all([...toAdd.map((planId) => api.addLink(taskId, planId)), ...toRemove.map((planId) => api.removeLink(taskId, planId))]);
    await refreshProgress(state.plans.map((p) => p.id));
  } catch (err) {
    commit({ ...state, links: before });
    throw err;
  }
}

export async function deleteTask(taskId) {
  const before = state;
  commit({ ...state, tasks: state.tasks.filter((t) => t.id !== taskId), links: state.links.filter((l) => l.task_id !== taskId) });
  try {
    await api.deleteTask(taskId);
    await refreshProgress(state.plans.map((p) => p.id));
  } catch (err) {
    commit(before);
    throw err;
  }
}

// ── 계획 만들기·수정·삭제(P0-5, P0-6) ───────────────
export async function createPlan({ plan_type, title, period_start, period_end, parent_id }) {
  const row = await api.createPlan({ plan_type, title, period_start, period_end, parent_id });
  commit({ ...state, plans: [...state.plans, row] });
  await refreshProgress([row.id]);
  return row;
}

export async function updatePlan(planId, patch) {
  const before = state.plans.find((p) => p.id === planId);
  if (!before) return;
  commit({ ...state, plans: state.plans.map((p) => (p.id === planId ? { ...p, ...patch } : p)) });
  try {
    await api.updatePlan(planId, patch);
    await refreshProgress(state.plans.map((p) => p.id));
  } catch (err) {
    commit({ ...state, plans: state.plans.map((p) => (p.id === planId ? before : p)) });
    throw err;
  }
}

// 계획을 지워도 연결된 할 일과 하위 계획은 남고, 연결만 해제됩니다(PRD P0-5). 서버가 하위 계획의
// parent_id 를 비우고(on delete set null) 연결 행만 지우므로, 화면 상태도 같은 규칙으로 맞춥니다.
export async function deletePlan(planId) {
  const before = state;
  commit({
    ...state,
    plans: state.plans.filter((p) => p.id !== planId).map((p) => (p.parent_id === planId ? { ...p, parent_id: null } : p)),
    links: state.links.filter((l) => l.plan_id !== planId),
  });
  try {
    await api.deletePlan(planId);
    await refreshProgress(state.plans.map((p) => p.id).filter((id) => id !== planId));
  } catch (err) {
    commit(before);
    throw err;
  }
}

// 링크 뷰에서 노드의 점을 끌어 새 연결을 만들 때 씁니다(PRD P0-7: 할 일은 계획 0개 이상에 연결). 이미 있는 연결이면 아무 일도 하지 않습니다.
export async function addLink(taskId, planId) {
  if (state.links.some((l) => l.task_id === taskId && l.plan_id === planId)) return false;
  commit({ ...state, links: [...state.links, { task_id: taskId, plan_id: planId }] });
  try {
    await api.addLink(taskId, planId);
    await refreshProgress(state.plans.map((p) => p.id));
    return true;
  } catch (err) {
    commit({ ...state, links: state.links.filter((l) => !(l.task_id === taskId && l.plan_id === planId)) });
    throw err;
  }
}

// 연결선을 클릭해 삭제할 때 씁니다. 삭제 후 그 계획과의 연결이 하나도 없으면 할 일은 개별 상태가 됩니다(DESIGN.md 6-6).
export async function removeLink(taskId, planId) {
  const before = state.links;
  commit({ ...state, links: state.links.filter((l) => !(l.task_id === taskId && l.plan_id === planId)) });
  try {
    await api.removeLink(taskId, planId);
    await refreshProgress(state.plans.map((p) => p.id));
    return true;
  } catch (err) {
    commit({ ...state, links: before });
    throw err;
  }
}
