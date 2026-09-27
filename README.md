# 링크 플랜 (Link Plan)

할 일 → 주간 → 월간 → 연간 목표를 연결하고, 진행률을 자동으로 계산하는 할 일 앱입니다.

- 저장소: https://github.com/poguni/link-plan.git
- 기술: Vanilla JS(ES 모듈), 빌드 도구 없음, SortableJS, supabase-js(CDN), GitHub Pages

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `index.html` | 앱 진입점 |
| `dev.html` | 컴포넌트·테마·뷰 확인용 임시 페이지(개발 전용, 배포 대상 아님) |
| `config.js` | Supabase URL·anon 키 자리(service_role 키는 넣지 않음) |
| `css/` | `tokens.css`(디자인 토큰), `base.css`, `components.css`, `shell.css`(셸 배치), `view-board.css`, `view-link.css` |
| `js/` | `app.js`, `theme.js`, `shell.js`, `icons.js`, `ui.js`, `state.js`, `progress.js`, `api.js`, `board.js`, `link.js`, `admin.js` |
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

## 진행률 계산 검증 (콘솔에서)

서버를 켜고 http://localhost:8000/index.html 을 연 뒤, 브라우저 개발자 도구 콘솔에서 아래를 붙여 넣으면 됩니다.
샘플 데이터(`design/sample-data.json`)를 읽으며, 화면에 적힌 `done`·`total`·`progress` 값은 쓰지 않고 항상 규칙대로 계산합니다.

```js
const { planProgress } = await import('/js/progress.js');
const { getState, setTaskStatus } = await import('/js/state.js');

// 예시 1) 연간 목표: 하위 계획(월간·주간)과 직접 연결된 할 일을 중복 없이 셉니다.
//         "클로드 코드 책 읽기"(t0)는 월간과 연간에 함께 연결돼 있어도 한 번만 셉니다.
planProgress('y1', getState());   // { total: 6, done: 2, pct: 33 }

// 예시 2) 월간 계획: 직접 연결(t0) + 하위 주간 계획의 할 일(t1~t3) = 4건 중 1건 완료
planProgress('m1', getState());   // { total: 4, done: 1, pct: 25 }

// 예시 3) 완료로 바꾸면 연결된 계획의 진행률이 바로 바뀌고, 연결이 없는 계획은 "측정 전"(pct: null)입니다.
planProgress('w1', getState());   // { total: 3, done: 1, pct: 33 }
await setTaskStatus('t3', 'done');
planProgress('w1', getState());   // { total: 3, done: 2, pct: 67 }
planProgress('없는계획', getState()); // { total: 0, done: 0, pct: null }
```

저장 실패 시 되돌리기는 아래처럼 시험합니다. 다음 저장 한 번이 실패하고, 옮긴 카드가 원래 열로 돌아오면서 안내가 뜹니다.

```js
(await import('/js/api.js')).simulateWriteFailure();
// 이제 카드를 다른 열로 옮겨 보세요.
```

## 진행 상황

단계별(Phase) 계획은 `docs/PROMPTS.md` 를 따릅니다. 현재는 Phase 2(보드 뷰, 정적 데이터)까지 끝났습니다.

- 앱: http://localhost:8000/index.html (보드 뷰는 동작하고, 링크 뷰는 Phase 3 에서 만듭니다)
- 컴포넌트 확인: http://localhost:8000/dev.html (테마·뷰 전환 버튼 포함)
