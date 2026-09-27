// 메모리 상태 저장소. 구독(변경 알림) 방식이고, 상태는 이 파일의 함수로만 바꿉니다.
// 화면은 getState() 로 읽고 subscribe() 로 변경을 받습니다. 상태 객체를 직접 고치지 않습니다(항상 새 객체로 교체).
import * as api from './api.js';

const STATUSES = ['todo', 'doing', 'done'];

let state = { plans: [], tasks: [], links: [], ready: false };
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

export async function loadState() {
  commit({ ...(await api.loadAll()), ready: true });
}

// 낙관적 업데이트: 화면 상태를 먼저 바꾸고 저장합니다. 저장이 실패하면 그 할 일만 원래대로 되돌리고 오류를 다시 던집니다.
// 완료로 바꾸면 완료 시각을 기록하고, 다른 상태로 되돌리면 지웁니다(PRD P0-3).
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
    return true;
  } catch (err) {
    commit({ ...state, tasks: state.tasks.map((t) => (t.id === taskId ? before : t)) });
    throw err;
  }
}

// 링크 뷰에서 노드의 점을 끌어 새 연결을 만들 때 씁니다(PRD P0-7: 할 일은 계획 0개 이상에 연결). 이미 있는 연결이면 아무 일도 하지 않습니다.
export async function addLink(taskId, planId) {
  if (state.links.some((l) => l.task_id === taskId && l.plan_id === planId)) return false;
  commit({ ...state, links: [...state.links, { task_id: taskId, plan_id: planId }] });
  try {
    await api.addLink(taskId, planId);
    return true;
  } catch (err) {
    commit({ ...state, links: state.links.filter((l) => !(l.task_id === taskId && l.plan_id === planId)) });
    throw err;
  }
}

// 연결선을 클릭해 삭제할 때 씁니다. 삭제 후 그 계획과의 연결이 하나도 없으면 할 일은 독립 상태가 됩니다(DESIGN.md 6-6).
export async function removeLink(taskId, planId) {
  const before = state.links;
  commit({ ...state, links: state.links.filter((l) => !(l.task_id === taskId && l.plan_id === planId)) });
  try {
    await api.removeLink(taskId, planId);
    return true;
  } catch (err) {
    commit({ ...state, links: before });
    throw err;
  }
}
