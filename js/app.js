// 앱 진입점: 아이콘 스프라이트 → 테마·뷰 복원 → 셸 그리기 순서로 시작합니다.
import { loadIcons } from './icons.js';
import { initTheme } from './theme.js';
import { renderShell, bindShell } from './shell.js';

async function start() {
  await loadIcons();
  initTheme();
  renderShell(document.getElementById('app'));
  bindShell();
}

start().catch((err) => {
  console.error(err);
  document.getElementById('app').textContent = '화면을 불러오지 못했어요. 새로고침해 주세요.';
});
