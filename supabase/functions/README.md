# admin-api Edge Function

관리자 전용 작업(사용자 승인·비밀번호 초기화·계정 삭제·데이터 JSON 저장·데이터 삭제)을 처리합니다.
`service_role` 키가 필요한 작업이라 브라우저에서 직접 할 수 없고, 이 함수 안에서만 그 키를 씁니다(PRD 5-7).

## 배포

이번 배포는 Claude Code 가 Supabase MCP(`deploy_edge_function`)로 직접 올렸습니다. `verify_jwt: true`
로 배포돼 있어(로그인 토큰이 없으면 함수 코드가 실행되기 전에 게이트웨이가 401로 막습니다), 별도 설정이
더 필요하지 않습니다.

코드를 고친 뒤 다시 배포할 때, Supabase CLI 가 있다면 이 방법도 됩니다.

```bash
supabase login
supabase link --project-ref sobpuuaxqnkyfbkgfyxq
supabase functions deploy admin-api
```

CLI 가 없으면 다음에 Claude Code 에게 "admin-api 다시 배포해 줘"라고 하면 MCP 로 같은 일을 합니다.

## 시크릿 설정 (직접 해야 함 — MCP/CLI 로 자동화할 수 없는 부분)

`ALLOWED_ORIGIN` 시크릿을 반드시 설정해야 브라우저(관리자 페이지)에서 이 함수를 호출할 수 있습니다.
설정 전에는 함수가 정상 동작해도(로그인·권한 확인은 통과) CORS 응답 헤더(`Access-Control-Allow-Origin`)가
비어 있어서 **브라우저가 응답을 거부합니다**(관리자 페이지 콘솔에 `CORS` 오류로 보입니다).

**대시보드에서 설정하는 방법**
1. Supabase 대시보드 → 이 프로젝트 → **Edge Functions** → **admin-api** → **Secrets** 탭(또는 프로젝트
   전체 시크릿은 **Project Settings → Edge Functions**).
2. `ALLOWED_ORIGIN` = 지금 로컬에서 테스트한다면 `http://localhost:8000` (포트가 다르면 그 포트로).
   나중에 GitHub Pages 로 배포하면(Phase 9) `https://아이디.github.io` 처럼 실제 배포 주소로 바꿔야 합니다.
3. 저장하면 몇 초 안에 반영됩니다(재배포 불필요).

**CLI 로 설정하는 방법(선택)**
```bash
supabase secrets set ALLOWED_ORIGIN=http://localhost:8000 --project-ref sobpuuaxqnkyfbkgfyxq
```

`SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`는 모든 Edge Function에 Supabase 가 자동으로 넣어 주는
환경 변수라서 따로 설정할 필요가 없습니다.

## 로컬(브라우저 콘솔)에서 호출 시험

관리자 계정으로 로그인한 상태에서, 브라우저 개발자 도구 콘솔에 붙여 넣습니다.

```js
const { supabase } = await import('/js/api.js');
const { data: { session } } = await supabase.auth.getSession();
const res = await fetch('https://sobpuuaxqnkyfbkgfyxq.supabase.co/functions/v1/admin-api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
  body: JSON.stringify({ action: 'list_users' }),
});
console.log(res.status, await res.json());
```

관리자가 아닌 계정으로 같은 걸 실행하면 403(`{"error":"관리자만 할 수 있어요."}`)이 나와야 정상입니다.
로그인하지 않은 상태(토큰 없음)에서는 401 이 나와야 합니다.

## 문제 해결

| 증상 | 원인 | 확인 |
|---|---|---|
| 콘솔에 CORS 오류(`has been blocked by CORS policy`) | `ALLOWED_ORIGIN` 시크릿이 없거나 지금 접속한 주소와 다름 | 위 "시크릿 설정" 참고. 주소는 `http://` / `https://`, 포트까지 정확히 같아야 합니다 |
| 401 Unauthorized | 로그인 세션이 없거나 만료됨 | 다시 로그인 후 시도. `session.access_token` 이 있는지 콘솔에서 확인 |
| 403 Forbidden(`관리자만 할 수 있어요`) | 로그인은 됐지만 `profiles.approved`·`is_admin` 중 하나가 거짓 | `03_admin_bootstrap.sql` 로 그 계정을 승인+관리자로 지정했는지 확인 |
| 400(`대상 사용자를 확인할 수 없어요`) | `user_id` 가 UUID 형식이 아니거나 비어 있음 | 관리자 화면 버그일 가능성 — 어떤 버튼을 눌렀는지 알려 주세요 |
| 400(`확인 이메일이 일치하지 않아요`) | 삭제 확인 모달에 입력한 이메일이 대상과 다름(대소문자·공백 포함 정확히 일치해야 함) | 모달에 보이는 이메일을 그대로 입력했는지 확인 |
