// 앱 진입점: 아이콘 스프라이트 → 테마 복원 → 인증 게이트(로그인 → 승인 대기 → 앱) 순서로 시작합니다.
import { loadIcons } from './icons.js';
import { initTheme } from './theme.js';
import { startAuthGate } from './authview.js';

async function start() {
  await loadIcons();
  initTheme();
  await startAuthGate();
}

start().catch((err) => {
  console.error(err);
  document.getElementById('app').textContent = '화면을 불러오지 못했어요. 새로고침해 주세요.';
});
