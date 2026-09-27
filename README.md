# 링크 플랜 (Link Plan)

할 일 → 주간 → 월간 → 연간 목표를 연결하고, 진행률을 자동으로 계산하는 할 일 앱입니다.

- 저장소: https://github.com/poguni/link-plan.git
- 기술: Vanilla JS(ES 모듈), 빌드 도구 없음, SortableJS, supabase-js(CDN), GitHub Pages

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `index.html` | 앱 진입점 |
| `config.js` | Supabase URL·anon 키 자리(service_role 키는 넣지 않음) |
| `css/` | `tokens.css`(디자인 토큰), `base.css`, `components.css`, `view-board.css`, `view-link.css` |
| `js/` | `app.js`, `state.js`, `api.js`, `theme.js`, `board.js`, `link.js`, `admin.js` |
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

## 진행 상황

단계별(Phase) 계획은 `docs/PROMPTS.md` 를 따릅니다. 현재는 Phase 0(프로젝트 준비)입니다.
