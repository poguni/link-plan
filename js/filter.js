// 검색·필터(P1-7). 계획별·상태별·개별 할 일 필터와 제목 검색을 보드·링크 뷰가 함께 씁니다.
// 상태(status)는 계획·개별 필터와 동시에 켤 수 있고(예: "이 계획의 완료만"), 계획(plan)과 개별(solo)은
// 서로 배타적입니다(한 할 일이 동시에 그 둘일 수 없으므로).
import { planTaskIds } from './progress.js';

let query = '';
let status = null;              // 'todo' | 'doing' | 'done' | null
let scope = null;                // { type: 'plan', id } | { type: 'solo' } | null

const listeners = new Set();
function notify() { listeners.forEach((fn) => fn(getFilter())); }

export function getFilter() { return { query, status, scope }; }
export function isActive() { return Boolean(query || status || scope); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function setQuery(next) { query = next.trim(); notify(); }
export function setStatus(next) { status = status === next ? null : next; notify(); }
export function setScope(next) {
  scope = (scope && scope.type === next.type && scope.id === next.id) ? null : next;
  notify();
}
export function clearScope() { scope = null; notify(); }
export function clearFilter() { query = ''; status = null; scope = null; notify(); }

export function matchTask(task, s) {
  if (status && task.status !== status) return false;
  if (query && !task.title.toLowerCase().includes(query.toLowerCase())) return false;
  if (scope?.type === 'solo') {
    if (s.links.some((l) => l.task_id === task.id)) return false;
  } else if (scope?.type === 'plan') {
    if (!planTaskIds(scope.id, s.plans, s.links).has(task.id)) return false;
  }
  return true;
}
