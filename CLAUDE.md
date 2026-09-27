# 링크 플랜 (Link Plan) — 프로젝트 규칙

할 일 → 주간 → 월간 → 연간 목표를 연결하고 진행률을 자동 계산하는 할 일 앱입니다.

## 먼저 읽을 문서
1. `DESIGN.md` — 화면·디자인의 기준 (6가지 = 뷰 2 × 테마 3)
2. `PRD.md` — 기능, 데이터 모델, RLS, 로그인·관리자
3. `tokens.css`, `icons.svg`, `sample-data.json`, `mockups/*.html`

## 기술 스택 (변경 금지)
- Vanilla JS(ES 모듈), **빌드 도구 없음**, 프레임워크 없음
- SortableJS(드래그 앤 드롭), supabase-js(CDN), GitHub Pages 배포
- Supabase는 이 앱 전용 새 프로젝트. 테이블 접두사 없음. 모든 테이블에 RLS 필수

## 디자인 규칙
- `<html data-theme="clean|night|pastel" data-view="board|link">` 로 전환한다. 6가지 조합 모두 지원해야 한다.
- 컴포넌트 CSS 에 색 코드를 직접 쓰지 않는다. `tokens.css` 변수만 쓴다.
- 이모지 금지. 아이콘은 `icons.svg`(Lucide)만 쓴다. 새 아이콘도 Lucide 에서 가져온다.
- 뷰는 배치, 테마는 겉모습만 바꾼다. 기능·데이터는 6가지 모두 같다.
- 시안과 문서가 다르면 시안 → DESIGN.md → tokens.css 순으로 따른다.
- 접근성: 글자 대비 4.5:1, 상태·단계는 색만으로 구분 금지, 드래그는 키보드 대안 필수.

## 보안 규칙
- `service_role` 키는 절대 프런트엔드 코드·저장소에 넣지 않는다(Edge Function `admin-api` 에서만).
- anon key 는 공개해도 되지만 RLS 가 전제다. 정책은 `(select auth.uid()) = user_id and (select private.is_approved())` 형태.
- 관리자 기능은 Edge Function 에서 관리자 여부를 서버에서 다시 검증한다.

## 작업 순서
1. `tokens.css`/`icons.svg` 적용, 테마·뷰 전환 뼈대
2. `sample-data.json` 으로 6가지 화면 정적 렌더링 → `previews/*.png` 와 비교
3. 보드 뷰 + 드래그 → 링크 뷰(좌표·연결선) → 상태 트레이 → 편집 모달 → 반응형
4. Supabase 연동(로그인·승인·RLS) → 관리자 페이지
5. `DESIGN.md` 11절 검수 체크리스트로 마무리

## 문체
- 화면 문구·주석·커밋 메시지는 한국어 존댓말 기본, 맞춤법과 띄어쓰기를 확인한다.
