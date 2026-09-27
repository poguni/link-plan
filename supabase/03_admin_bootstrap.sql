-- 링크 플랜 — 03. 첫 관리자 지정
-- 근거: PRD.md 5-7 "첫 관리자 지정". 01, 02 를 실행한 뒤, 관리자로 쓸 계정으로 먼저 가입(signup)한 다음 실행합니다.
--
-- 사용법
-- 1. 관리자로 쓸 이메일로 앱(또는 대시보드 Authentication > Add user)에서 먼저 가입합니다.
--    가입하면 01_schema.sql 의 트리거(private.handle_new_user)가 profiles 행을 자동으로 만듭니다
--    (approved=false, is_admin=false 인 상태로 시작합니다).
-- 2. 아래 UPDATE 문의 'ADMIN_EMAIL_HERE' 를 실제 관리자 이메일로 바꿔 실행합니다.
-- 3. 이 방법(SQL)로만 관리자 권한을 부여합니다. 화면에서 관리자 권한을 주는 기능은 만들지 않습니다(PRD P1-18).
--    마지막 관리자를 잃지 않도록, 관리자 계정을 지우거나 강등하기 전에는 반드시 다른 관리자를 먼저 만들어 두세요.

update public.profiles
set approved = true, approved_at = now(), is_admin = true
where email = 'ADMIN_EMAIL_HERE';

-- 확인: 아래 결과에 방금 지정한 이메일이 approved=true, is_admin=true 로 나오면 성공입니다.
select id, email, approved, is_admin, created_at, approved_at
from public.profiles
where email = 'ADMIN_EMAIL_HERE';
