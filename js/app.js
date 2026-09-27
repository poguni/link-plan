// 앱 진입점: 아이콘 스프라이트 → 데이터 → 테마·뷰 복원 → 셸 → 보드 뷰 순서로 시작합니다.
import { loadIcons } from './icons.js';
import { loadState } from './state.js';
import { initTheme } from './theme.js';
import { renderShell, bindShell } from './shell.js';
import { mountBoard } from './board.js';
import { mountLink } from './link.js';

async function start() {
  await Promise.all([loadIcons(), loadState()]);
  initTheme();
  renderShell(document.getElementById('app'));
  bindShell();
  mountBoard();
  mountLink();
}

start().catch((err) => {
  console.error(err);
  document.getElementById('app').textContent = '화면을 불러오지 못했어요. 새로고침해 주세요.';
});
