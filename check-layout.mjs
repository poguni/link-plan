// 링크 뷰 레이아웃 검증 스크립트. 실행: node check-layout.mjs
// design/sample-data.json 으로 js/layout.js 의 계산 결과가 DESIGN.md 6-2 표(night·clean 기준)와 맞는지 비교합니다.
// 이 파일은 검수용이며 배포 대상이 아닙니다(CLAUDE.md 「하지 말 것」: 배포물에 포함하지 않음).
import { readFileSync } from 'node:fs';
import { computeLayout } from './js/layout.js';

const raw = JSON.parse(readFileSync(new URL('./design/sample-data.json', import.meta.url)));
const PLAN_TYPE = { year: 'yearly', month: 'monthly', week: 'weekly' };
const plans = raw.plans.map((p) => ({ id: p.id, plan_type: PLAN_TYPE[p.plan_type], title: p.title, parent_id: p.parent_id }));
const tasks = raw.tasks.map((t) => ({ id: t.id, title: t.title, status: t.status }));
const links = raw.task_plan_links.map((l) => ({ task_id: l.task_id, plan_id: l.plan_id }));

const columns = { x0: [40, 360, 680, 1000], width: 240 };   // night·clean 기준(clean 은 x0 만 다르고 top 값은 같음)
const layout = computeLayout({ plans, tasks, links, columns });

// DESIGN.md 6-2 표(night·clean 기준). 순서는 plans/tasks 배열 순서와 같습니다.
const expected = {
  y1: 285, y2: 502,
  m1: 190, m2: 400, m3: 512,
  w1: 224, w2: 400, w3: 512,
  t0: 110, t1: 174, t2: 238, t3: 302, t4: 382, t5: 446, t6: 526,
};

console.log('id\t기대\t실제\t차이\t결과');
let mismatches = 0;
for (const [id, want] of Object.entries(expected)) {
  const got = Math.round(layout.byId.get(id).top);
  const diff = got - want;
  if (diff !== 0) mismatches++;
  console.log(`${id}\t${want}\t${got}\t${diff >= 0 ? '+' : ''}${diff}\t${diff === 0 ? 'OK' : '차이'}`);
}
console.log(`\n개별 할 일 헤더 y = ${layout.soloHeaderY} (기대 606)`);
console.log(`${mismatches === 0 ? '모두 일치합니다.' : `${mismatches}건이 시안과 다릅니다(아래 설명 참고).`}`);
