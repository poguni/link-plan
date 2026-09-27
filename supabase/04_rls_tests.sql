-- 링크 플랜 — 04. RLS 검증 체크리스트 (PRD.md 5-5, 19개 시나리오)
-- 01·02·03 을 실행한 뒤, 이 파일을 위에서부터 한 블록씩 SQL Editor 에서 실행합니다.
-- 각 블록 실행 후, 그 위 주석의 "기대 결과"와 실제 결과가 같은지 확인하세요. 하나라도 다르면 배포하지 않습니다.
-- 번호는 PRD 5-5 표의 번호와 같습니다.
--
-- 사용자를 바꿔 가며 확인하는 방법: PRD 는 "set local request.jwt.claim.sub = '<사용자 id>'"를 안내하지만,
-- SET 문은 고정된 문자열만 받고 (select ...) 처럼 값을 계산해 넣을 수는 없습니다. 그래서 이메일로 id 를 찾아
-- 그 자리에서 넣어 주는 함수 select set_config('request.jwt.claim.sub', (select ...), true) 를 대신 씁니다.
-- true(마지막 인자)는 SET LOCAL 과 같이 트랜잭션이 끝나면 원래대로 돌아간다는 뜻입니다.
--
-- [직접 할 일 — 이 파일을 실행하기 전에]
-- 1. 대시보드 Authentication > Add user 로 테스트 계정 3개를 만듭니다(비밀번호는 아무거나, 8자+영문+숫자).
--    - test-a@example.com, test-b@example.com  (아래에서 승인 처리합니다)
--    - test-c@example.com                       (승인하지 않고 그대로 둡니다 — "승인 전 사용자" 역할)
-- 2. 아래를 실행해 A, B 를 승인합니다(관리자일 필요는 없습니다. 03_admin_bootstrap.sql 과 다른 점에 주의).
update public.profiles set approved = true, approved_at = now()
where email in ('test-a@example.com', 'test-b@example.com');
-- C 는 그대로 둡니다(approved = false).

-- ── 1: 로그인 없이 anon 키로 조회 ───────────────────────────────
-- 기대: 네 조회 모두 권한 오류(42501)
set local role anon;
select * from public.plans;
select * from public.tasks;
select * from public.task_plan_links;
select * from public.plan_progress;
reset role;

-- ── 2: A가 로그인해 자신의 할 일·계획·연결을 만들고 수정·삭제 ─────
-- 기대: 모두 성공
begin;
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-a@example.com'), true);
  set local role authenticated;

  insert into public.plans (plan_type, title, period_start, period_end)
    values ('yearly', 'RLS 테스트 연간(A)', '2026-01-01', '2026-12-31');
  insert into public.tasks (title) values ('RLS 테스트 할 일(A)');
  insert into public.task_plan_links (task_id, plan_id)
    select
      (select id from public.tasks where title = 'RLS 테스트 할 일(A)'),
      (select id from public.plans where title = 'RLS 테스트 연간(A)');

  update public.plans set title = 'RLS 테스트 연간(A, 수정)' where title = 'RLS 테스트 연간(A)';
  delete from public.task_plan_links
    where task_id = (select id from public.tasks where title = 'RLS 테스트 할 일(A)');
  -- 위 세 문장이 오류 없이 실행되면 성공입니다. 아래 계획·할 일은 이후 시나리오에서 계속 씁니다(지우지 않음).
commit;

-- ── 3: B가 A의 할 일·계획·연결을 조회 ───────────────────────────
-- 기대: 세 조회 모두 0행
begin;
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-b@example.com'), true);
  set local role authenticated;
  select * from public.plans where title like 'RLS 테스트%(A%';
  select * from public.tasks where title like 'RLS 테스트%(A%';
  select * from public.task_plan_links l join public.plans p on p.id = l.plan_id where p.title like 'RLS 테스트%(A%';
rollback;

-- ── 4: B가 A의 행을 수정·삭제 ────────────────────────────────────
-- 기대: 오류 없이 0행에만 적용되고, A의 데이터는 그대로
begin;
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-b@example.com'), true);
  set local role authenticated;
  update public.plans set title = 'B가 바꿔봄' where title = 'RLS 테스트 연간(A, 수정)';
  delete from public.plans where title = 'RLS 테스트 연간(A, 수정)';
rollback;
-- 확인: A로 다시 조회하면(시나리오 2 처럼 role·claim 을 바꾼 후) 제목이 그대로인지 봅니다.

-- ── 5: B가 user_id를 A의 id로 넣어 새 행을 저장 ──────────────────
-- 기대: 정책 위반으로 저장 실패
begin;
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-b@example.com'), true);
  -- A 의 id 도 role 을 바꾸기 전에 미리 구해 둡니다(authenticated 는 auth.users 를 직접 조회할 권한이 없음).
  select set_config('app.test_a_id', (select id::text from auth.users where email = 'test-a@example.com'), true);
  set local role authenticated;
  insert into public.plans (user_id, plan_type, title, period_start, period_end)
    values (current_setting('app.test_a_id')::uuid, 'yearly', 'B가 A 행세', '2026-01-01', '2026-12-31');
rollback;

-- ── 6: B가 A의 계획 id로 자기 할 일을 연결 ───────────────────────
-- 기대: 실패(성공하면 안 됨). B는 RLS 때문에 A의 계획을 조회할 수조차 없어서 plan_id 서브쿼리가
--       NULL이 되고, NOT NULL 제약(23502)으로 막힙니다. (혹시 조회가 됐더라도 (plan_id, user_id)
--       복합 외래 키가 "B 소유 계획이 아니다"라며 23503으로 막았을 것입니다.) 둘 중 어느 오류가
--       나든 "B가 A의 계획에 연결하지 못한다"는 결론은 같습니다.
begin;
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-b@example.com'), true);
  set local role authenticated;
  insert into public.tasks (title) values ('B의 할 일(FK 테스트)');
  insert into public.task_plan_links (task_id, plan_id)
    select
      (select id from public.tasks where title = 'B의 할 일(FK 테스트)'),
      (select id from public.plans where title = 'RLS 테스트 연간(A, 수정)');
rollback;

-- ── 6-부록: check_plan_parent 도 같은 것을 막는지(01_schema.sql 에서 user_id 조건을 추가한 부분 확인) ──
-- 기대: 친절한 한국어 오류("허용되지 않는 상위 계획 유형입니다")로 실패. 원시 외래 키 오류가 아니어야 합니다.
begin;
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-b@example.com'), true);
  set local role authenticated;
  insert into public.plans (plan_type, title, period_start, period_end, parent_id)
    values ('monthly', 'B의 월간(부모=A 것)', '2026-01-01', '2026-01-31',
      (select id from public.plans where title = 'RLS 테스트 연간(A, 수정)'));
rollback;

-- ── 7: 주간 계획을 연간 목표에 바로 연결 ──────────────────────────
-- 기대: 트리거 예외로 실패
begin;
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-a@example.com'), true);
  set local role authenticated;
  insert into public.plans (plan_type, title, period_start, period_end, parent_id)
    values ('weekly', '건너뛴 주간', '2026-01-01', '2026-01-07',
      (select id from public.plans where title = 'RLS 테스트 연간(A, 수정)'));
rollback;

-- ── 8: B가 진행률 뷰를 조회 ───────────────────────────────────────
-- 기대: B의 데이터만 집계됨(A 의 계획은 보이지 않음)
begin;
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-b@example.com'), true);
  set local role authenticated;
  select * from public.plan_progress;
rollback;

-- ── 9: 하위 주간 계획이 있는 월간 계획의 유형을 연간으로 변경 ─────
-- 기대: 트리거 예외로 실패하고, 계획은 그대로
begin;
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-a@example.com'), true);
  set local role authenticated;
  insert into public.plans (plan_type, title, period_start, period_end, parent_id)
    values ('monthly', 'RLS 테스트 월간(A)', '2026-01-01', '2026-01-31',
      (select id from public.plans where title = 'RLS 테스트 연간(A, 수정)'));
  insert into public.plans (plan_type, title, period_start, period_end, parent_id)
    values ('weekly', 'RLS 테스트 주간(A)', '2026-01-01', '2026-01-07',
      (select id from public.plans where title = 'RLS 테스트 월간(A)'));
  update public.plans set plan_type = 'yearly' where title = 'RLS 테스트 월간(A)';
rollback;

-- ── 10: 트랜잭션 안에서 grant 없이 임시 테이블을 만들고 조회 ──────
-- 기대: 기본 권한 잠금 때문에 anon·authenticated 둘 다 권한 오류(42501)
begin;
  create table public._rls_probe (id int);
  set local role anon;
  select * from public._rls_probe;
  reset role;
  set local role authenticated;
  select * from public._rls_probe;
rollback;

-- ── 11: 대시보드의 Advisors(보안 점검) 실행 ───────────────────────
-- SQL 이 아니라 대시보드 작업입니다: Database > Advisors 에서 RLS 관련 경고가 없는지 확인하세요.

-- ── 12: 승인 전 사용자(C)가 조회하거나 저장 ───────────────────────
-- 기대: 조회는 0행, 저장은 정책 위반으로 실패
begin;
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-c@example.com'), true);
  set local role authenticated;
  select * from public.plans;
  select * from public.tasks;
  insert into public.tasks (title) values ('C가 시도');
rollback;

-- ── 13: 일반 사용자가 profiles에서 다른 사용자의 행을 조회 ────────
-- 기대: 0행
begin;
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-a@example.com'), true);
  set local role authenticated;
  select * from public.profiles where email = 'test-b@example.com';
rollback;

-- ── 14: 일반 사용자가 profiles의 approved·is_admin을 수정·추가·삭제 ─
-- 기대: 권한 오류(42501). profiles 에는 select 권한만 있고 insert·update·delete 권한 자체가 없습니다.
begin;
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-a@example.com'), true);
  set local role authenticated;
  update public.profiles set approved = true, is_admin = true where email = 'test-a@example.com';
rollback;

-- ── 15: 승인을 취소한 직후, 같은 세션에서 조회 ────────────────────
-- 기대: 토큰 만료를 기다리지 않고 즉시 0행(is_approved() 가 매번 profiles 를 다시 읽기 때문)
begin;
  update public.profiles set approved = false where email = 'test-a@example.com';
  select set_config('request.jwt.claim.sub', (select id::text from auth.users where email = 'test-a@example.com'), true);
  set local role authenticated;
  select * from public.plans;   -- 기대: 0행
rollback;   -- rollback 으로 A의 승인 취소를 되돌립니다(실제로 취소하려는 게 아니라 확인용이므로).

-- ── 16, 17: 관리자 API 관련 ───────────────────────────────────────
-- SQL 로 확인할 수 없습니다. Phase 7 에서 admin-api 를 배포한 뒤 HTTP 요청이나 관리자 페이지로 확인하세요.
-- 16) 토큰 없이 / anon 키만으로 / 일반 사용자 토큰으로 호출 → 401 또는 403
-- 17) 자기 자신 삭제, 관리자 계정 삭제·승인 취소, 자기 비밀번호 초기화 시도 → 모두 거절

-- ── 18: 새 계정으로 가입 ──────────────────────────────────────────
-- 대시보드 Add user 또는(Phase 5 완성 후) 가입 화면으로 새 이메일을 만든 뒤 아래로 확인합니다.
-- 기대: profiles 행이 자동으로 1개 생기고 approved, is_admin 이 모두 false
-- select id, email, approved, is_admin from public.profiles where email = '방금 가입한 이메일';

-- ── 19: 비밀번호 규칙 위반으로 가입 시도 ──────────────────────────
-- SQL 이 아니라 대시보드 설정(Authentication > Providers > Email, 최소 길이 8·Digits and letters) 테스트입니다.
-- 7자 비밀번호, 영문만, 숫자만인 비밀번호로 가입을 시도해 모두 거절되는지 확인하세요.

-- ── 뒷정리: 테스트로 만든 데이터 지우기 ───────────────────────────
delete from public.plans where title like 'RLS 테스트%' or title like '건너뛴 주간';
delete from public.tasks where title like 'RLS 테스트%' or title like 'B의 할 일(FK 테스트)' or title = 'C가 시도';
