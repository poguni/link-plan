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
