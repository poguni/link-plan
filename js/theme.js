// 테마·뷰 전환. <html> 의 data-theme(clean|night|pastel) 과 data-view(board|link) 만 바꿉니다.
// 데이터를 다시 불러오지 않고 새로고침 없이 즉시 적용합니다. 테마 이름으로 분기하는 코드는 두지 않고,
// 모양은 CSS 의 [data-theme] 선택자가 맡습니다.
// 선택값은 localStorage 에 저장합니다(계정 저장은 Phase 6 에서 붙입니다).

export const THEMES = ['clean', 'night', 'pastel'];
export const VIEWS = ['board', 'link'];

// 키 이름은 PRD 5-2, 6-8 규칙(linkplan_ 접두사)을 따릅니다.
const THEME_KEY = 'linkplan_theme';
const VIEW_KEY = 'linkplan_view';

// 선택된 테마의 서체만 늦게 불러옵니다(DESIGN.md 2-2). 도착하기 전에는 시스템 서체로 보입니다.
const FONT_URLS = {
  clean: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap',
  night: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Space+Grotesk:wght@500;700&display=swap',
  pastel: 'https://fonts.googleapis.com/css2?family=Gowun+Dodum&family=Jua&display=swap',
};
const loadedFonts = new Set();

const root = document.documentElement;

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch { /* 저장소를 못 쓰는 환경에서는 저장만 건너뜁니다. */ }
}

function loadFonts(theme) {
  if (loadedFonts.has(theme)) return;
  loadedFonts.add(theme);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = FONT_URLS[theme];
  document.head.appendChild(link);
}

function announce() {
  document.dispatchEvent(new CustomEvent('linkplan:change', { detail: { theme: getTheme(), view: getView() } }));
}

export function getTheme() { return root.dataset.theme; }
export function getView() { return root.dataset.view; }

export function setTheme(theme) {
  if (!THEMES.includes(theme)) return;
  root.dataset.theme = theme;
  write(THEME_KEY, theme);
  loadFonts(theme);
  announce();
}

export function setView(view) {
  if (!VIEWS.includes(view)) return;
  root.dataset.view = view;
  write(VIEW_KEY, view);
  announce();
}

// 저장된 값(없으면 기본값 clean·board)을 복원합니다. 첫 화면 깜빡임은 index.html 의 작은 인라인 스크립트가 먼저 막습니다.
export function initTheme() {
  const theme = THEMES.includes(read(THEME_KEY)) ? read(THEME_KEY) : 'clean';
  const view = VIEWS.includes(read(VIEW_KEY)) ? read(VIEW_KEY) : 'board';
  root.dataset.theme = theme;
  root.dataset.view = view;
  loadFonts(theme);
  announce();
}
