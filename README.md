# 링크 플랜 (Link Plan)

할 일 → 주간 → 월간 → 연간 목표를 연결하고, 진행률을 자동으로 계산하는 할 일 앱입니다. 가입 후 관리자가
승인한 사용자만 쓸 수 있습니다. 클린·나이트·파스텔 3가지 테마와 보드 뷰·링크 뷰 2가지 화면(6가지 조합)을
지원합니다.

- 저장소: https://github.com/poguni/link-plan.git
- 기술: Vanilla JS(ES 모듈), 빌드 도구 없음, SortableJS(CDN), Supabase(Auth·DB·Edge Function), GitHub Pages
- 기준 문서: `docs/PRD.md`(기능·데이터), `design/DESIGN.md`(화면), `docs/PROMPTS.md`(개발 단계)

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `index.html` | 앱 진입점(로그인·가입·승인 대기·보드·링크 뷰) |
| `admin.html` | 관리자 페이지(관리자가 아니면 `index.html`로 돌려보냄) |
| `404.html` | GitHub Pages용 찾을 수 없음 페이지 |
| `config.js` | Supabase 프로젝트 URL과 anon(publishable) 키(service_role 키는 절대 넣지 않음) |
| `css/` | `tokens.css`(디자인 토큰, 색은 여기만), `base.css`, `components.css`, `shell.css`, `view-board.css`, `view-link.css`, `auth.css`, `admin.css` |
| `js/` | `app.js`(진입점), `theme.js`, `period.js`, `shell.js`, `icons.js`, `ui.js`, `state.js`, `progress.js`, `layout.js`, `api.js`, `auth.js`, `authview.js`, `board.js`, `link.js`, `taskmodal.js`, `planmodal.js`, `admin.js` |
| `assets/icons.svg` | 아이콘 스프라이트(Lucide) — 새 아이콘도 여기에만 추가 |
| `supabase/` | 스키마·RLS SQL(`01`~`04`), 관리자 지정 SQL(`03_admin_bootstrap.sql`), `functions/admin-api/`(Edge Function) |
| `.github/workflows/deploy.yml` | GitHub Pages 배포 워크플로(빌드 없음, 필요한 파일만 골라 올림) |
| `DEPLOY_CHECKLIST.md` | 배포 전 확인 목록(PRD 5-5·5-6 기준) |
| `docs/` | `PRD.md`, `PROMPTS.md` — 배포 대상 아님(내부 기획 문서) |
| `design/` | `DESIGN.md`, 시안(`mockups/`), 검수 스크린샷(`previews/`) — 배포 대상 아님 |
| `dev.html`, `check-layout.mjs` | 개발용 도구(배포 대상 아님) |

## 로컬에서 실행하기

빌드가 필요 없는 정적 사이트입니다. ES 모듈을 쓰므로 `index.html`을 더블클릭하지 말고 로컬 서버로 여세요.

```bash
# Python 이 있을 때
python -m http.server 8000

# Node.js 가 있을 때
npx serve -l 8000
```

브라우저에서 http://localhost:8000 을 엽니다(관리자 페이지는 `/admin.html`, 컴포넌트 확인은 `/dev.html`).

Supabase에 처음 연결한다면 `config.js`에 프로젝트 URL과 anon 키를 넣고, `supabase/` 폴더의 SQL을
`01_schema.sql` → `02_rls.sql` → `03_admin_bootstrap.sql`(관리자 이메일로 바꿔서) → `04_rls_tests.sql` 순서로
SQL Editor에서 실행하세요. 자세한 절차는 `supabase/README.md`, Edge Function 배포는
`supabase/functions/README.md`를 참고하세요.

## 배포 (GitHub Pages)

1. GitHub 저장소를 만들고 이 코드를 푸시합니다(git 작업은 직접 하며, Claude Code는 대신하지 않습니다).
2. 저장소 **Settings → Pages → Source**를 **GitHub Actions**로 설정합니다. `.github/workflows/deploy.yml`이
   `main` 브랜치에 푸시할 때마다 자동으로 배포합니다. 이 워크플로는 `docs/`·`design/`·`supabase/` 등 내부 문서는
   빼고 `index.html`·`admin.html`·`404.html`·`config.js`·`css/`·`js/`·`assets/`만 올립니다.
3. 배포된 주소(`https://아이디.github.io/저장소이름/`)를 Supabase **Authentication → URL Configuration**의
   Site URL·Redirect URLs에 등록하고, Edge Function `admin-api`의 **`ALLOWED_ORIGIN`** 시크릿을 같은 주소로
   맞춥니다.
4. 자세한 배포 전 확인 항목은 **`DEPLOY_CHECKLIST.md`**를 따르세요(직접 해야 하는 대시보드 설정과, 이미 자동으로
   확인해 둔 항목을 나눠 뒀습니다).

CSS·진입 스크립트에는 `?v=9` 같은 캐시 무효화 쿼리가 붙어 있습니다. **CSS나 JS를 바꿔 다시 배포할 때마다
`index.html`·`admin.html`의 `?v=` 숫자를 올려 주세요.** (ES 모듈 `import`는 이 쿼리가 전파되지 않아 완벽하진
않습니다 — 배포 후 이상하면 하드 새로고침으로 확인하세요.)

## 관리자 지정

1. 관리자로 쓸 계정으로 **배포된 사이트(또는 로컬)에서 먼저 회원가입**합니다.
2. `supabase/03_admin_bootstrap.sql`의 `ADMIN_EMAIL_HERE`를 그 이메일로 바꿔 SQL Editor에서 실행합니다.
3. 다른 사람을 추가 관리자로 만들 때도 이메일만 바꿔 같은 파일을 다시 실행하면 됩니다.
4. 관리자 권한은 이 SQL로만 부여합니다(화면에는 권한 부여 기능이 없습니다, P1-18로 미룸). 마지막 관리자를
   지우거나 강등하기 전에는 반드시 다른 관리자를 먼저 만들어 두세요.

## 백업

무료 플랜은 다운로드 가능한 자동 백업이 없습니다. 관리자 페이지의 "JSON 저장" 버튼으로 사용자별 데이터를
정기적으로 내려받거나, `pg_dump`/Supabase 대시보드의 Backups를 쓰세요. 자세한 내용은 `DEPLOY_CHECKLIST.md`의
"백업" 절을 참고하세요.

## 문제 해결

| 증상 | 원인·확인 방법 |
|---|---|
| 화면이 하얗고 콘솔에 모듈 관련 오류 | `index.html`을 파일로 직접 열면 안 됩니다(ES 모듈은 `http://`로만 동작). 로컬 서버로 여세요 |
| 관리자 페이지에서 버튼을 눌러도 반응 없음(CORS 오류) | `ALLOWED_ORIGIN` 시크릿이 지금 접속한 주소와 다릅니다. `supabase/functions/README.md`의 "문제 해결" 참고 |
| 배포 주소에서 `/admin.html` 등 새로고침 시 404 | GitHub Pages Source가 "GitHub Actions"로 설정돼 있는지, 워크플로가 성공했는지(Actions 탭) 확인 |
| 로그인은 되는데 승인 대기 화면만 나옴 | 정상입니다 — 관리자가 승인해야 앱에 들어갑니다("관리자 지정" 절 참고해 승인) |
| 가입 후에도 `profiles` 행이 안 생김 | Phase 4 SQL(트리거 `handle_new_user`)이 그 시점에 없었을 수 있습니다. `supabase/03_admin_bootstrap.sql`처럼 `auth.users`에서 다시 만들어 넣는 SQL로 복구하세요 |
| 새로고침해도 예전 화면(CSS/JS)이 보임 | 배포 시 `?v=` 캐시 무효화 값을 올렸는지 확인하고, 하드 새로고침(Ctrl+Shift+R) |

---

## 개발자 참고(검증 스니펫)

### 진행률은 서버 값 기준입니다

화면의 진행률은 `plan_progress` 뷰 값입니다(`js/progress.js`의 `planProgress()`가 `state.progress`에 있으면 그
값을, 아직 못 불러왔을 때만 로컬 계산으로 대신합니다). 로그인한 뒤 콘솔에서 직접 비교할 수 있습니다.

```js
const { supabase } = await import('/js/api.js');
const { getState } = await import('/js/state.js');
const planId = getState().plans[0]?.id;
await supabase.from('plan_progress').select('*').eq('plan_id', planId);
```

저장 실패 시 되돌리기(P0-4)는 개발자 도구 네트워크 탭에서 "Offline"을 켜고 카드를 다른 열로 옮겨 보면
됩니다(원래 열로 돌아오고 토스트가 뜹니다).

### 보안 점검(RLS)을 콘솔에서 직접

```js
const { supabase } = await import('/js/api.js');
// 남의 user_id 로 저장 시도 → 거부되어야 정상(42501)
await supabase.from('plans').insert({
  user_id: '00000000-0000-0000-0000-000000000000',
  plan_type: 'yearly', title: '테스트', period_start: '2026-01-01', period_end: '2026-12-31',
});
// 로그인하지 않은 상태에서 조회 → 항상 빈 배열
await supabase.from('plans').select('*');
```

### 링크 뷰 좌표 검증

`js/layout.js`는 DOM 없이 노드 좌표만 계산하는 순수 함수입니다.

```bash
node check-layout.mjs
```

`design/sample-data.json` 기준 15개 중 13개가 `design/DESIGN.md` 6-2 표와 정확히 일치합니다. 나머지 2개는
"할 일이 주간을 건너뛰고 월간·연간에 직접 연결된 경우, 상위 계획의 세로 위치에 얼마나 영향을 주는지"를
DESIGN.md가 명확히 정하지 않아 생기는 차이로, "부모는 자식들의 세로 중앙에 맞춘다"는 규칙을 일관되게 적용하는
쪽을 택했습니다.

## 설계 결정 메모

- **링크 뷰는 기간별로 필터링하지 않습니다.** 기간(일일·주간·월간·연간) 전환은 보드 뷰에만 적용됩니다. 링크
  뷰는 연결 구조 전체를 한눈에 보는 화면이라는 목적을 유지하기 위해 항상 전체 그래프를 보여 줍니다.
- **계획(연간·월간·주간) 만들기·수정 진입점은 화면마다 다릅니다.** 목표 패널(좌측)은 연간만, 클린·나이트의
  "계획이 이어지는 목표" 사슬은 주간·월간만, 파스텔의 펼친 트리는 전체, 링크 뷰 노드는 전체 단계를
  다룹니다. 6가지 조합 모두에서 계획 CRUD 자체는 어떤 진입점으로든 도달할 수 있습니다.
- **좁은 화면(600px 미만)의 좌측 패널**은 완전한 아이콘 전용 레일로 만들지 않고, 햄버거로 여는 드로어로
  만들었습니다. 완전 아이콘 레일은 계획 필터 기능 자체를 없애 버리기 때문입니다(DESIGN.md 9절에 시안이 없어
  기능 우선으로 결정).
