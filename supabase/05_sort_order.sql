-- 링크 플랜 — 05. 열 안 순서(sort_order) 추가 (P1-1, Phase 10)
-- 근거: docs/PROMPTS.md Phase 10, docs/PRD.md P1-1. 01~04 를 이미 실행한 프로젝트의 Supabase SQL Editor에서
-- 한 번만 실행합니다. tasks 테이블에 열만 하나 추가하므로 기존 데이터·RLS 정책에는 영향이 없습니다.
--
-- [설계 메모]
-- 정수 대신 double precision(부동소수) 을 씁니다. 카드를 두 카드 사이로 끌어다 놓으면 클라이언트가
-- (이전 값 + 다음 값) / 2 를 계산해 저장하므로, 그때마다 같은 열의 다른 카드들 순서 값을 다시 매길 필요가
-- 없습니다(js/board.js 의 reorderTask). 기본값은 "지금 시각(초)"이라 새로 만든 할 일은 항상 그 순간까지의
-- 어떤 값보다 커서 자연히 열 맨 아래에 놓입니다(지금까지의 "만든 순서" 동작과 같습니다).

alter table public.tasks
  add column sort_order double precision not null default extract(epoch from clock_timestamp());

-- 기존 행은 만든 시각을 그대로 순서 값으로 씁니다(원래 order by created_at 과 정확히 같은 순서가 됩니다).
update public.tasks set sort_order = extract(epoch from created_at);
