# 링크 플랜 (Link Plan)

할 일 → 주간 → 월간 → 연간 목표를 연결하고, 진행률을 자동으로 계산하는 할 일 앱입니다.

- 저장소: https://github.com/poguni/link-plan.git
- 기술: Vanilla JS(ES 모듈), 빌드 도구 없음, SortableJS, supabase-js(CDN), GitHub Pages

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `index.html` | 앱 진입점 |
| `admin.html` | 관리자 페이지 진입점(관리자가 아니면 index.html로 돌려보냄) |
| `dev.html` | 컴포넌트·테마·뷰 확인용 임시 페이지(개발 전용, 배포 대상 아님) |
| `config.js` | Supabase URL·anon 키 자리(service_role 키는 넣지 않음) |
| `css/` | `tokens.css`(디자인 토큰), `base.css`, `components.css`, `shell.css`(셸 배치), `view-board.css`, `view-link.css`, `auth.css`, `admin.css` |
| `js/` | `app.js`, `theme.js`, `shell.js`, `icons.js`, `ui.js`, `state.js`, `progress.js`, `layout.js`, `period.js`, `api.js`, `auth.js`, `authview.js`, `board.js`, `link.js`, `taskmodal.js`, `planmodal.js`, `admin.js` |
| `supabase/functions/admin-api/` | 관리자 전용 Edge Function(TypeScript, Deno). service_role 키는 여기서만 씀 |
| `check-layout.mjs` | 링크 뷰 좌표 검증 스크립트(검수용, 배포 대상 아님). `node check-layout.mjs` |
| `docs/screenshots/` | 검수용 스크린샷(1280×820). 시안 미리보기는 `design/previews/` |
| `assets/` | `icons.svg`(Lucide 스프라이트) |
| `design/` | 디자인 기준 문서·시안(`DESIGN.md`, `mockups/`, `previews/`, `sample-data.json` 등) |
| `docs/` | `PRD.md`, `PROMPTS.md` |

## 로컬에서 실행하기

빌드가 필요 없는 정적 사이트입니다. ES 모듈을 쓰므로 `index.html` 을 더블클릭하지 말고, 로컬 서버로 열어 주세요.

프로젝트 폴더에서 아래 중 하나를 실행합니다.

```bash
# Python 이 있을 때
python -m http.server 8000

# Node.js 가 있을 때
npx serve -l 8000
```

브라우저에서 http://localhost:8000 을 엽니다.

## 진행률 계산 확인 (Phase 6부터: 서버 값 기준)

Phase 2~5 에서는 `design/sample-data.json` 을 읽는 로컬 계산만 있었지만, Phase 6부터는 화면에 보이는 진행률이
**서버의 `plan_progress` 뷰** 값입니다(`js/progress.js` 의 `planProgress()` 가 `state.progress` 에 있으면 그 값을,
아직 못 불러왔을 때만 로컬 계산으로 대신합니다). 로그인한 뒤 콘솔에서 아래처럼 서버 값을 직접 확인할 수 있습니다.

```js
const { supabase } = await import('/js/api.js');
const { getState } = await import('/js/state.js');
const planId = getState().plans[0]?.id;
await supabase.from('plan_progress').select('*').eq('plan_id', planId);
```

드래그·연결 변경 직후 화면이 먼저 바뀌었다가(로컬 계산, 즉시) 곧이어 서버 값으로 다시 맞춰지는지는
개발자 도구의 network 탭에서 `plan_progress` 요청이 상태 변경 직후에 뒤따라 나가는 것으로 확인할 수 있습니다.

저장 실패 시 되돌리기(P0-4)는 개발자 도구의 네트워크 탭에서 "Offline" 을 켜고 카드를 다른 열로 옮겨 보면 됩니다.
저장이 실패해 카드가 원래 열로 돌아오고 안내 토스트가 뜹니다.

## 보안 점검(RLS): 브라우저 콘솔에서 다른 사용자 데이터 접근 시도

로그인한 상태에서 콘솔에 아래를 붙여 넣어, 화면을 거치지 않고 API 를 직접 불러도 RLS 가 막는지 확인합니다
(Phase 6 완료 기준: 미승인·다른 사용자 데이터는 조회 0행·저장 실패).

```js
const { supabase } = await import('/js/api.js');

// 1) 존재하지 않는(또는 남의) user_id 로 계획을 만들려 하면 거부됩니다.
//    → { error: { code: '42501', message: 'new row violates row-level security policy ...' } }
await supabase.from('plans').insert({
  user_id: '00000000-0000-0000-0000-000000000000',
  plan_type: 'yearly', title: '테스트', period_start: '2026-01-01', period_end: '2026-12-31',
});

// 2) anon(비로그인) 키로는 아무 것도 못 봅니다. 새 시크릿 창에서 로그인하지 않고 같은 코드를 실행하면
//    data 가 항상 빈 배열([])입니다.
await supabase.from('plans').select('*');
```

승인이 취소된 계정도 즉시 막히는지는 관리자(Phase 7)가 `profiles.approved` 를 `false` 로 바꾼 뒤,
그 사용자로 새로고침 없이 같은 조회를 실행해 빈 배열이 나오는지로 확인합니다(토큰 만료를 기다리지 않음, PRD P0-16).

## 진행 상황

단계별(Phase) 계획은 `docs/PROMPTS.md` 를 따릅니다. 현재는 Phase 7(관리자 페이지와 admin-api Edge Function)까지 끝났습니다. `supabase/` 폴더의 SQL은 사용자가 대시보드에서 직접 실행합니다(`supabase/README.md` 참고). `admin-api` Edge Function 배포·시크릿 설정은 `supabase/functions/README.md` 를 참고하세요 — **`ALLOWED_ORIGIN` 시크릿은 아직 사용자가 대시보드에서 직접 설정해야 합니다**(MCP·CLI로 자동화할 수 없는 부분).

Phase 6 범위와 관련해 미리 알아 둘 점 두 가지:
- **링크 뷰는 기간별로 필터링하지 않습니다.** 기간(일일·주간·월간·연간) 전환은 보드 뷰의 칸반·목표 요약에만 적용됩니다. 링크 뷰는 Phase 3 설계 그대로 전체 계획·할 일 그래프를 항상 보여 줍니다(연결 구조를 한눈에 보는 화면이라는 원래 목적을 유지하기 위한 선택입니다).
- **계획(연간·월간·주간) 만들기·수정 진입점**은 화면마다 다릅니다. 목표 패널(좌측)에서는 연간 목표 추가·수정만, "이번 주/달 계획이 이어지는 목표" 사슬(클린·나이트)에서는 주간·월간 계획 추가·수정만, 파스텔의 펼쳐진 트리에서는 연간·월간·주간 모두, 링크 뷰 노드에서는 모든 단계의 추가·수정이 가능합니다. 6가지 조합 모두에서 계획 CRUD 자체는 어떤 진입점으로든 도달할 수 있습니다.

- 앱: http://localhost:8000/index.html (보드 뷰·링크 뷰 모두 동작합니다)
- 컴포넌트 확인: http://localhost:8000/dev.html (테마·뷰 전환 버튼 포함)

## 링크 뷰 좌표 검증

`js/layout.js` 는 DOM 없이 노드 좌표만 계산하는 순수 함수입니다. 아래로 실행하면 `design/sample-data.json` 으로 계산한
좌표가 `design/DESIGN.md` 6-2 표와 맞는지 확인합니다.

```bash
node check-layout.mjs
```

15개 중 13개가 정확히 일치합니다. 나머지 2개(`m1`, `y1`)는 "할 일이 주간을 건너뛰고 월간·연간에 직접 연결된 경우,
그 직접 연결이 상위 계획의 세로 위치에 얼마나 영향을 주는지"를 DESIGN.md 가 명확히 정하지 않아서 생기는 차이입니다.
한 가지 예(t0)만으로 규칙을 거꾸로 추정하면 과적합이 될 수 있어, 문서에 쓰인 "부모는 자식들의 세로 중앙에 맞춘다"는
규칙을 일관되게 적용하는 쪽을 택했습니다. `check-layout.mjs` 실행 결과에 두 값의 차이가 그대로 나타납니다.
