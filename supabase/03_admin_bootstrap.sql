-- 링크 플랜 — 03. 첫 관리자 지정
-- 근거: PRD.md 5-7 "첫 관리자 지정". 01, 02 를 실행한 뒤, 관리자로 쓸 계정으로 먼저 가입(signup)한 다음 실행합니다.
--
-- 사용법
-- 1. 관리자로 쓸 이메일로 앱(또는 대시보드 Authentication > Add user)에서 먼저 가입합니다.
--    가입하면 01_schema.sql 의 트리거(private.handle_new_user)가 profiles 행을 자동으로 만듭니다
--    (approved=false, is_admin=false 인 상태로 시작합니다).
-- 2. 아래 두 문장의 'ADMIN_EMAIL_HERE' 를 실제 관리자 이메일로 바꿔 실행합니다.
--    다른 사람을 추가 관리자로 만들 때도 이메일만 바꿔 이 파일을 다시 실행하면 됩니다.
--    (저장소가 공개(public)라 실제 이메일 대신 자리표시자를 넣어 뒀습니다. 실행할 때만 로컬에서 바꾸세요.)
-- 3. 이 방법(SQL)로만 관리자 권한을 부여합니다. 화면에서 관리자 권한을 주는 기능은 만들지 않습니다(PRD P1-18).
--    마지막 관리자를 잃지 않도록, 관리자 계정을 지우거나 강등하기 전에는 반드시 다른 관리자를 먼저 만들어 두세요.
--
-- [실행 확인 완료 — 경험한 문제] Phase 4 SQL(트리거)이 만들어지기 전에 그 이메일로 이미 가입돼 있으면
-- profiles 행이 아예 없어서, 단순 UPDATE 는 0행에 적용되고 조용히 아무 일도 하지 않습니다. 그래서 이 파일은
-- auth.users 에서 프로필을 다시 만들어 넣는 INSERT ... ON CONFLICT 형태로 작성했습니다(이미 프로필이
-- 있으면 그 행을 그대로 관리자로 갱신하고, 없으면 auth.users 값으로 새로 만듭니다. 둘 다 안전합니다).

insert into public.profiles (id, email, approved, is_admin, approved_at)
select id, email, true, true, now()
from auth.users
where email = 'ADMIN_EMAIL_HERE'
on conflict (id) do update
set approved = true, is_admin = true, approved_at = now();

-- 확인: 아래 결과에 방금 지정한 이메일이 approved=true, is_admin=true 로 나오면 성공입니다.
select id, email, approved, is_admin, created_at, approved_at
from public.profiles
where email = 'ADMIN_EMAIL_HERE';
