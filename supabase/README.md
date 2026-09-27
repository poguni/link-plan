# Supabase 설정 (Phase 4)

이 폴더의 SQL은 Claude Code가 만들었지만, **실행은 사용자가 Supabase 대시보드에서 직접** 합니다.
근거 문서는 `docs/PRD.md` 5장입니다.

## 준비물 (SQL을 실행하기 전에)

1. Supabase 프로젝트가 이미 있어야 합니다(Postgres 15 이상).
2. **Authentication → Providers → Email**
   - **Confirm email**을 끕니다(관리자 승인이 그 역할을 합니다).
   - 비밀번호 최소 길이 **8**, 필수 문자 옵션에서 **"Digits and letters"**를 켭니다.
   - 이 설정은 SQL을 실행하기 **전에** 해 두세요. 나중에 강화하면 이미 약한 비밀번호로 만든 계정이 로그인할 때 오류를 받습니다(PRD 5-6).

## 실행 순서

SQL Editor에서 아래 순서대로, 파일 하나가 끝나고 오류가 없는지 확인한 뒤 다음 파일로 넘어갑니다.

| 순서 | 파일 | 하는 일 |
|---|---|---|
| 1 | `01_schema.sql` | 기본 권한 잠금, 테이블(plans·tasks·task_plan_links·profiles·user_settings), 트리거(상위 계획 규칙, 완료 시각 자동 기록, 프로필 자동 생성) |
| 2 | `02_rls.sql` | 모든 테이블 RLS 켜기, 정책, 진행률 뷰(`plan_progress`) |
| 3 | `03_admin_bootstrap.sql` | 첫 관리자 지정(이메일을 바꿔 넣고 실행) |
| 4 | `04_rls_tests.sql` | RLS가 실제로 막아야 할 것을 막는지 확인(19개 시나리오) |
| 5 | `05_sort_order.sql` | (Phase 10, P1-1) `tasks`에 `sort_order` 열 추가 — 같은 열 안 카드 순서 저장용. 배포된 앱이 이미 있다면 나머지 파일과 달리 **아무 때나** 실행해도 안전합니다(기존 데이터·정책에 영향 없음) |

`01_schema.sql`을 실행하기 **전에** 아무 계정도 없어야 트리거·정책이 꼬이지 않습니다. 이미 가입한 계정이 있다면
`private.handle_new_user` 트리거가 그 계정들의 `profiles` 행은 만들어 주지 않으니, 필요하면 수동으로 만들어 주세요.

## 3. `03_admin_bootstrap.sql` 실행 방법

1. 관리자로 쓸 이메일로 먼저 앱(또는 대시보드 Authentication → Add user)에서 가입합니다.
2. 파일을 열어 `ADMIN_EMAIL_HERE`를 실제 이메일로 바꿉니다(두 군데입니다: UPDATE 문과 확인용 SELECT 문).
3. SQL Editor에서 실행합니다. 마지막 SELECT 결과에 `approved=true`, `is_admin=true`가 보이면 성공입니다.

## 4. `04_rls_tests.sql` 확인 방법

이 파일은 대시보드 Authentication에서 테스트 계정 3개(`test-a@example.com`, `test-b@example.com` 승인,
`test-c@example.com` 승인 안 함)를 먼저 만든 뒤 실행합니다. 파일 맨 위 주석에 이 절차가 적혀 있습니다.

- 한 번에 전체를 실행해도 되고, 블록 하나씩(`begin` ~ `commit`/`rollback`) 실행해 가며 각 블록 위 주석의
  "기대 결과"와 실제 결과를 눈으로 비교해도 됩니다.
- `rollback`으로 끝나는 블록은 테스트가 끝나면 원래대로 돌아갑니다. 실제 데이터를 지우거나 바꾸지 않습니다.
- 파일 맨 끝에 테스트용으로 만든 데이터(제목이 "RLS 테스트"로 시작하는 것들)를 지우는 문장이 있습니다.
- 16, 17번(관리자 API), 18, 19번(가입 화면·비밀번호 규칙)은 SQL만으로 확인할 수 없습니다. Phase 5·7에서
  화면이 만들어진 뒤 다시 확인하세요. 파일 안에 무엇을 확인해야 하는지 주석으로 남겨 두었습니다.
- 하나라도 "기대 결과"와 다르면 배포하지 말고, 어느 시나리오에서 어떻게 달랐는지 알려 주세요.

## 확인: RLS가 켜져 있는지

**Database → Policies**에서 `plans`, `tasks`, `task_plan_links`, `profiles`, `user_settings` 다섯 개 테이블 모두
RLS가 켜져 있고, 각 테이블에 정책이 있는지 눈으로 확인합니다.

## Postgres 버전 확인

`on delete set null (parent_id)`(복합 외래 키 중 한 열만 지정해서 비우는 문법)과 `security_invoker` 뷰는
Postgres 15부터 지원합니다. Supabase 프로젝트가 15 미만이면 `01_schema.sql`에서 오류가 납니다.

## service_role 키

이 폴더의 SQL 어디에도 `service_role` 키를 쓰지 않습니다. 관리자 기능(계정 삭제·비밀번호 초기화 등)은
Phase 7의 Edge Function `admin-api`에서만 그 키를 씁니다.

## PRD 원문과 다르게 정리한 부분

`01_schema.sql` 맨 위 주석에 자세히 적어 두었습니다. 요약하면 세 가지입니다.

1. "기본 권한 잠그기" SQL을 `02_rls.sql`이 아니라 `01_schema.sql` 맨 앞으로 옮겼습니다(PRD 5-2 본문이 테이블을
   만들기 전에 실행하라고 되어 있어서입니다).
2. `check_plan_parent()` 트리거가 상위 계획을 찾을 때 `user_id`도 함께 확인하도록 한 줄 추가했습니다(사용자 확인 완료).
3. 할 일이 완료로 바뀌면 `completed_at`을 서버가 자동으로 기록하는 트리거를 추가했습니다(사용자 확인 완료).
