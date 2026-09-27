# 링크 플랜 디자인 핸드오프 패키지

Claude Code 에게 이 폴더를 그대로 넘기면 됩니다. 시작 문장 예시:

> `CLAUDE.md` 와 `DESIGN.md` 를 먼저 읽고, `PRD.md` 의 기능을 `mockups/` 의 6가지 시안과 똑같이 구현해 줘. 1단계는 정적 데이터(`sample-data.json`)로 6가지 화면을 렌더링하는 것까지야.

## 구성

| 파일 | 내용 | 언제 보나요 |
|---|---|---|
| `CLAUDE.md` | 프로젝트 규칙(스택·금지 사항·작업 순서) | 작업 시작 전에 항상 |
| `PROMPTS.md` | Claude Code 에 순서대로 붙여 넣을 단계별(Phase 0~10) 프롬프트 | 구현을 시작할 때 |
| `DESIGN.md` | 디자인 기준서: 6가지 뷰×테마, 토큰, 컴포넌트, 좌표, 접근성, 반응형 | 화면을 만들 때 |
| `PRD.md` | 제품 요구사항 + 기술 스택 + DB(RLS) + 로그인·관리자 | 기능·데이터를 만들 때 |
| `tokens.css` | 3개 테마 CSS 변수 + 뷰 규칙 | 그대로 복사해서 사용 |
| `icons.svg` | Lucide 아이콘 스프라이트 27개 | 그대로 복사해서 사용 |
| `sample-data.json` | 링크 뷰 시안을 재현하는 샘플 데이터 | 정적 렌더링·검수 |
| `mockups/*.html` | 6가지 시안(정적, 1280×820) | 브라우저로 열어 눈으로 비교 |
| `previews/*.png` | 시안 스크린샷 | 구현 결과와 나란히 비교 |

## 6가지 시안

| | 보드 뷰 | 링크 뷰 |
|---|---|---|
| 클린 | `mockups/clean-board.html` | `mockups/clean-link.html` |
| 나이트 | `mockups/night-board.html` | `mockups/night-link.html` |
| 파스텔 | `mockups/pastel-board.html` | `mockups/pastel-link.html` |

## 주의
- 시안은 **참고용 정적 화면**입니다. 코드를 복사하지 말고 값과 구조를 읽어 컴포넌트로 다시 만드세요.
- 시안은 Google Fonts 를 인터넷에서 불러옵니다. 오프라인이면 기본 서체로 보입니다.
- 시안이 없는 화면(로그인, 관리자, 모달, 모바일)은 `DESIGN.md` 9·10절 규칙으로 만듭니다.
- 온라인 원본 시안: 디자인 캔버스(클로드 앱의 「링크 플랜 디자인 시안 6종」).
