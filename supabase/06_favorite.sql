-- 링크 플랜 — 06. 중요 표시(is_favorite) 추가
-- 근거: 할 일 카드·수정 화면의 하트 아이콘으로 중요하거나 수행 만족도가 높은 할 일을 표시합니다.
-- 01~05 를 이미 실행한 프로젝트의 Supabase SQL Editor에서 한 번만 실행합니다. tasks 테이블에 열만
-- 하나(기본값 false) 추가하므로 기존 데이터·RLS 정책에는 영향이 없어 05 처럼 아무 때나 실행해도 안전합니다.

alter table public.tasks
  add column is_favorite boolean not null default false;
