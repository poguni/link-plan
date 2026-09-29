-- 링크 플랜 — 07. 계획 순서(sort_order) 추가
-- 근거: 사용자 요청(왼쪽 목표 패널·링크 뷰에서 연간 목표를 드래그 앤 드롭으로 순서 바꾸기). 01~06 을 이미
-- 실행한 프로젝트의 Supabase SQL Editor에서 한 번만 실행합니다. plans 테이블에 열만 하나 추가하므로
-- 기존 데이터·RLS 정책에는 영향이 없습니다.
--
-- [설계 메모]
-- tasks.sort_order(05_sort_order.sql)와 똑같은 방식입니다. 정수 대신 double precision(부동소수) 을 씁니다.
-- 카드를 두 카드 사이로 끌어다 놓으면 클라이언트가 (이전 값 + 다음 값) / 2 를 계산해 저장하므로, 그때마다
-- 같은 목록의 다른 계획들 순서 값을 다시 매길 필요가 없습니다(js/board.js 의 reorderGoal, js/link.js 의
-- reorderYear). 기본값은 "지금 시각(초)"이라 새로 만든 계획은 항상 그 순간까지의 어떤 값보다 커서 자연히
-- 맨 아래에 놓입니다(지금까지의 "만든 순서" 동작과 같습니다).

alter table public.plans
  add column sort_order double precision not null default extract(epoch from clock_timestamp());

-- 기존 행은 만든 시각을 그대로 순서 값으로 씁니다(원래 order by created_at 과 정확히 같은 순서가 됩니다).
update public.plans set sort_order = extract(epoch from created_at);
