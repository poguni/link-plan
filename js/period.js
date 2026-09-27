// 기간별 뷰(일일·주간·월간·연간) 계산. DOM 없는 순수 함수입니다(PRD P0-9).
// 선택된 기간 종류는 <html data-period>(shell.js 가 관리)를 그대로 따르고, 이 파일은 "기준 날짜(anchor)"만 memory 에 둡니다.

export const PERIODS = ['day', 'week', 'month', 'year'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const NAV_WORD = { day: '날', week: '주', month: '달', year: '해' };

const pad = (n) => String(n).padStart(2, '0');
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function startOfWeek(d) {
  const diff = (d.getDay() + 6) % 7; // 월요일 시작
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfYear(d) { return new Date(d.getFullYear(), 0, 1); }
function endOfYear(d) { return new Date(d.getFullYear(), 11, 31); }

export function rangeOf(period, anchor) {
  if (period === 'day') return { start: anchor, end: anchor };
  if (period === 'week') { const s = startOfWeek(anchor); return { start: s, end: new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6) }; }
  if (period === 'month') return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  return { start: startOfYear(anchor), end: endOfYear(anchor) };
}

export function shiftAnchor(period, anchor, dir) {
  const d = new Date(anchor);
  if (period === 'day') d.setDate(d.getDate() + dir);
  else if (period === 'week') d.setDate(d.getDate() + dir * 7);
  else if (period === 'month') d.setMonth(d.getMonth() + dir);
  else d.setFullYear(d.getFullYear() + dir);
  return d;
}

// 해당 월의 몇째 주인지(그 달 1일이 속한 주를 1주차로 셉니다).
function weekOfMonth(d) {
  const firstWeekStart = startOfWeek(startOfMonth(d));
  const thisWeekStart = startOfWeek(d);
  return Math.round((thisWeekStart - firstWeekStart) / (7 * 86400000)) + 1;
}

export function labelOf(period, anchor) {
  const y = anchor.getFullYear(), m = anchor.getMonth() + 1, dd = anchor.getDate();
  if (period === 'day') return { long: `${y}년 ${m}월 ${dd}일 · ${WEEKDAYS[anchor.getDay()]}요일`, short: `${m}/${dd}` };
  if (period === 'week') {
    const { start, end } = rangeOf('week', anchor);
    return { long: `${y}년 ${m}월 ${weekOfMonth(anchor)}주차 · ${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`, short: `${m}월 ${weekOfMonth(anchor)}주차` };
  }
  if (period === 'month') return { long: `${y}년 ${m}월`, short: `${m}월` };
  return { long: `${y}년`, short: `${y}년` };
}

export function navLabel(period, dir) {
  return `${dir === 'prev' ? '이전' : '다음'} ${NAV_WORD[period]}`;
}

export function titleOf(period) {
  return { day: '오늘의 보드', week: '이번 주 보드', month: '이번 달 보드', year: '올해 보드' }[period];
}

// 계획의 기간(period_start~period_end)이 선택된 범위와 겹치는지.
export function overlaps(plan, range) {
  return plan.period_start <= isoOf(range.end) && plan.period_end >= isoOf(range.start);
}

// 주어진 유형의 계획 중 범위와 겹치는 첫 번째 계획을 고릅니다(보통 기간이 겹치지 않게 만드므로 1개).
export function planForRange(plans, planType, range) {
  return plans.filter((p) => p.plan_type === planType).find((p) => overlaps(p, range));
}

// 새 계획을 만들 때 기본으로 채울 기간(선택된 기간 기준).
export function defaultPeriodFor(planType, anchor) {
  const period = planType === 'weekly' ? 'week' : planType === 'monthly' ? 'month' : 'year';
  const r = rangeOf(period, anchor);
  return { start: isoOf(r.start), end: isoOf(r.end) };
}

// ── 기준 날짜(anchor) 저장. 기간 종류 자체는 <html data-period> 가 기준(shell.js). ──
let anchor = new Date(new Date().setHours(0, 0, 0, 0));
export function getAnchor() { return anchor; }
export function setAnchor(d) { anchor = d; }
export function getPeriod() { return document.documentElement.dataset.period || 'week'; }
