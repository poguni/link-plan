// 앱 진입점: 아이콘 스프라이트 → 테마 복원 → 인증 게이트(로그인 → 승인 대기 → 앱) 순서로 시작합니다.
import { loadIcons } from './icons.js';
import { initTheme } from './theme.js';
import { startAuthGate } from './authview.js';
import { showToast } from './ui.js';

// 네트워크가 끊기면 저장·불러오기가 실패하는 이유를 짐작할 수 있게 알려 줍니다(DESIGN.md 8절 오류 처리).
window.addEventListener('offline', () => showToast('네트워크 연결이 끊겼어요. 연결되면 다시 시도해 주세요.'));
window.addEventListener('online', () => showToast('다시 연결됐어요.'));

async function start() {
  await loadIcons();
  initTheme();
  await startAuthGate();
}

start().catch((err) => {
  console.error(err);
  document.getElementById('app').textContent = '화면을 불러오지 못했어요. 새로고침해 주세요.';
});
