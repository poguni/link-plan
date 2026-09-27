# 배포 체크리스트 (Phase 9, PRD 5-5·5-6 기준)

두 부분으로 나눴습니다.
- **직접 해야 하는 항목**: Supabase·GitHub 대시보드에서만 할 수 있는 설정입니다. Claude Code(MCP)가 대신할 수 없습니다.
- **자동 확인 가능한 항목**: SQL·grep·Playwright 등으로 확인할 수 있습니다. `(확인 완료)` 표시가 있으면 이번 세션에서 이미 통과를 확인한 항목입니다.

하나라도 실패하면 배포하지 않습니다(PRD 5-5).

## A. 직접 해야 하는 항목

### A-1. Supabase 프로젝트 설정
- [ ] 무료 플랜이면 활성 프로젝트가 2개 미만인지 확인
- [ ] Postgres 15 이상 확인(이미 만든 프로젝트라면 대시보드 상단에서 버전 확인)
- [ ] DB 비밀번호를 비밀번호 관리자에 보관
- [ ] Authentication → Providers → Email: **Confirm email 끄기**, **Allow new users to sign up 켜기**
- [ ] Authentication → Policies(비밀번호 규칙): 최소 길이 8, "Digits and letters" 켜기
- [ ] Authentication → Security → **Leaked password protection 켜기** (Advisor가 경고 중인 항목, Phase 5-6엔 없지만 배포 전에 켜 두길 권합니다)

### A-2. 도메인 연결(GitHub Pages 주소가 정해진 뒤)
- [ ] `origin`(https://github.com/poguni/link-plan.git)이 이미 연결돼 있고 Phase 8까지 푸시돼 있습니다 — 저장소가 **Public**인지 Settings에서 확인만 하면 됩니다(공개로 하기로 하셨죠. `supabase/03_admin_bootstrap.sql`의 이메일은 이미 자리표시자로 바꿔 뒀습니다). 이번 Phase 9 변경분은 아직 커밋 전이니 직접 커밋·푸시해 주세요
- [ ] 저장소 Settings → Pages → Source를 **GitHub Actions**로 설정(`.github/workflows/deploy.yml`이 이미 있음)
- [ ] 배포된 주소(`https://<아이디>.github.io/<저장소이름>/`) 확인
- [ ] Supabase → Authentication → URL Configuration: **Site URL**을 위 주소로, **Redirect URLs**에 같은 주소(+ 로컬 개발 주소 `http://localhost:8000` 등)를 추가
- [ ] Supabase → Edge Functions → `admin-api` → Secrets: **`ALLOWED_ORIGIN`을 배포 주소로 재설정**(로컬 테스트 때 `http://localhost:8000`으로 해 두셨다면 지금 바꿔야 관리자 페이지가 배포 주소에서 동작합니다)
- [ ] 관리자로 쓸 계정으로 **배포된 사이트에서** 가입 → `supabase/03_admin_bootstrap.sql`의 `ADMIN_EMAIL_HERE`를 실제 이메일로 바꿔 SQL Editor에서 실행(로컬 테스트 때 이미 관리자를 지정했다면 건너뛰어도 됩니다)

### A-3. 백업·운영 대책
- [ ] 정기 백업 방법을 정함 — 아래 "백업" 절 참고, 캘린더 알림 등으로 주기 정하기
- [ ] 무료 플랜은 1주일 이상 미사용 시 프로젝트가 일시정지될 수 있음 — 대시보드에서 "Resume project"로 복구 가능하다는 것을 알아 두기. 계속 운영할 계획이면 Pro 플랜 검토

## B. 자동 확인 가능한 항목

### B-1. 배포 준비(코드)
- [x] **(확인 완료)** 상대 경로만 사용 — `grep`으로 `href="/`·`src="/`·절대경로 fetch 없음을 확인(하위 경로 배포에도 안전)
- [x] **(확인 완료)** `config.js`에 `SUPABASE_URL`·`SUPABASE_ANON_KEY`만 있고 `service_role`은 없음
- [x] **(완료)** 캐시 무효화: `index.html`·`admin.html`의 CSS·진입 스크립트에 `?v=9` 버전 쿼리 추가. **한계**: ES 모듈 `import`는 쿼리가 전파되지 않아 `js/` 안의 개별 파일까지 100% 무효화하진 못합니다 — 배포 후 화면이 이상하면 하드 새로고침(Ctrl+Shift+R)으로 확인해 주세요.
- [x] **(완료)** `404.html` 추가(앱 톤에 맞춘 안내 + 돌아가기 버튼)
- [x] **(결정 완료)** `docs/`·`design/`·`supabase/`는 배포 대상에서 제외 — `.github/workflows/deploy.yml`이 `index.html`·`admin.html`·`404.html`·`config.js`·`css/`·`js/`·`assets/`만 골라 올립니다. 이유: `docs/`엔 내부 기획 문서(PRD·프롬프트), `design/`엔 시안·검수 스크린샷이 있어 공개 웹사이트에 나올 필요가 없습니다. 저장소(git) 자체에는 그대로 남습니다.

### B-2. 비밀 값 검색(저장소 전체)
이번 세션에서 직접 검색해 확인했습니다.
- [x] `service_role` 문자열 검색 → 코드에는 없음(주석·설명 텍스트에만 언급, 실제 키 없음)
- [x] JWT 형태 문자열(`eyJ...`) 검색 → `config.js`의 anon(publishable) 키 하나뿐(디코딩하면 `"role":"anon"`, 공개해도 되는 키)
- [x] 비밀번호 리터럴 검색 → 없음
- [x] 개인 이메일 검색(gmail·naver·daum·kakao) → `supabase/03_admin_bootstrap.sql`에 있던 실제 관리자 이메일을 `ADMIN_EMAIL_HERE` 자리표시자로 교체 완료. `docs/` 의 PRD(.md/.docx/.pdf)에는 애초에 실제 이메일이 없었음을 확인.

재배포 전에 다시 검색하려면:
```bash
git grep -in "service_role" -- . ':!supabase/README.md' ':!supabase/functions/README.md' ':!README.md' ':!docs/*'
git grep -n "eyJ" -- .
git grep -niE "@(gmail|naver|daum|kakao)\.com" -- .
```

### B-3. RLS·DB 설정
- [x] **(확인 완료, 이번 세션)** `public.plans`·`profiles`·`task_plan_links`·`tasks`·`user_settings` 5개 테이블 모두 `rowsecurity = true`
- [x] **(확인 완료, 이번 세션)** Security Advisor: 경고 3건 모두 기존에 파악·검토된 항목(`rls_auto_enable`은 Supabase 플랫폼이 직접 관리하는 함수로 RLS 켜기를 도와주는 안전장치이지 취약점이 아님 — Phase 5에서 함수 정의를 직접 읽고 확인함; `auth_leaked_password_protection`은 위 A-1에서 켜는 대시보드 설정). **심각(critical) 등급 경고 없음.**
- [x] **(Phase 5에서 실행·확인 완료)** `supabase/04_rls_tests.sql`의 시나리오 1~15, 18~19 — PRD 5-5의 같은 번호 시나리오와 대응하며 전부 통과(사용자가 SQL Editor에서 직접 실행하거나 Claude Code가 Playwright로 확인)
- [x] **(Phase 7에서 확인 완료)** PRD 5-5 시나리오 16(관리자 API를 토큰 없이/일반 사용자 토큰으로 호출) — 토큰 없음 → 401, 승인된 일반 사용자 토큰 → 403 확인
- [ ] PRD 5-5 시나리오 17(관리자 API로 자기 자신 삭제·관리자 계정 삭제/승인 취소·자기 비밀번호 초기화 시도)은 `supabase/functions/admin-api/index.ts` 코드상 전부 거절하도록 작성돼 있지만(각 함수의 자기 자신·`is_admin` 검사), **실제 관리자 로그인으로 눌러서 거절되는지는 아직 라이브로 확인 못 했습니다.** 관리자 페이지에서 본인 계정에 "사용자 삭제"·"비밀번호 초기화" 버튼이 아예 비활성화되어 있는지만 한 번 봐주시면 충분합니다(버튼 자체가 꺼져 있어야 정상).

### B-4. 디자인 검수(DESIGN.md 11절, 6가지 조합)

| 항목 | 결과 | 확인 방법 |
| --- | --- | --- |
| 6가지 조합이 새로고침 없이 전환된다 | ✅ 통과 | Playwright로 `data-theme`×`data-view` 6가지를 순서대로 바꾸며 URL이 그대로인지(새로고침 없음), 콘솔 오류가 없는지 확인 |
| 컴포넌트 CSS에 하드코딩된 색이 없다 | ✅ 통과 | `grep -E "#[0-9A-Fa-f]{3,6}"`을 `components.css`·`shell.css`·`view-board.css`·`view-link.css`·`admin.css`·`auth.css`·`base.css`에 실행 — 0건(`tokens.css`만 색을 직접 씀, 규칙대로) |
| 이모지가 없다, 아이콘은 모두 icons.svg | ✅ 통과 | 유니코드 이모지 범위로 `js/`·`css/`·`*.html` 전체 스캔 — 0건 |
| 텍스트 대비 4.5:1 / 그래픽 3:1 | ✅ 통과 | 원본 감사는 DESIGN.md 8절에 있고(끌기 손잡이 2건만 예외로 이미 반영됨), Phase 8에서 새로 추가한 색 조합(상태 탭·관리자 배지·위험 버튼)도 3테마 모두 4.5:1 이상 재확인 |
| 키보드만으로 상태 변경·연결이 가능하다 | ✅ 통과 | 카드 Enter → 상태 메뉴, 모달은 Tab 순환(포커스 가두기)·Esc 닫기, 계획 연결은 체크리스트로 가능 |
| 링크 뷰 연결선이 리사이즈·드래그 후에도 맞는다 | ✅ 통과(Phase 3부터 유지) | `link.js`의 `ResizeObserver` + `requestAnimationFrame` 재계산, Phase 8에서 변경 없음 |
| 좌측 패널이 링크 뷰에서 clean=레일, night·pastel=숨김이다 | ✅ 통과(≥1200px 기준, 원본 규칙 그대로) | Phase 8에서는 1024~1199px 폭 전용 규칙만 추가했고 tokens.css 108~111행의 원본 규칙은 손대지 않음 |

axe-core(WCAG2A/AA) 결과는 보드 뷰·링크 뷰·모바일 드로어·모달 열림 상태 4가지에서 **위반 0건**(Phase 8에서 확인).

## 백업

무료 플랜은 다운로드 가능한 자동 백업이 없습니다(PRD 5-6). 두 가지 방법을 함께 씁니다.

1. **관리자 JSON 저장(권장, 지금 바로 가능)**: 관리자 페이지에서 사용자별로 "JSON 저장" 버튼을 눌러 `링크플랜_<이메일 앞부분>_<날짜>.json`로 내려받습니다. 사용자가 늘면 한 명씩 눌러야 하니, 초기에는 월 1회 정도를 권합니다(P1-13 "전체 사용자 JSON 저장"이 생기면 한 번에 가능).
2. **`pg_dump`(더 완전한 백업)**: Supabase 대시보드 → Database → Backups, 또는 CLI로 `supabase db dump`. 무료 플랜은 수동으로 직접 실행해야 합니다(자동 스케줄 없음).

캘린더 알림 등으로 주기(예: 매월 1일)를 정해 두는 걸 권합니다.
