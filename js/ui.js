// 화면 조각을 만드는 작은 도우미(HTML 문자열). 보드·링크 뷰가 함께 씁니다.
import { icon } from './icons.js';

// 사용자가 입력한 글자를 innerHTML 에 넣기 전에 반드시 거칩니다.
export function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 계획 단계: 색 + 아이콘 + 글자를 함께 씁니다(색만으로 구분하지 않음). 아이콘은 시안(mockups) 기준입니다.
export const LEVELS = {
  year: { icon: 'flag', label: '연간' },
  month: { icon: 'calendar', label: '월간' },
  week: { icon: 'calendar-days', label: '주간' },
  solo: { icon: 'unlink', label: '독립 할 일' },
};

export const STATUSES = {
  todo: { icon: 'circle', label: '시작 전' },
  doing: { icon: 'clock', label: '진행 중' },
  done: { icon: 'circle-check', label: '완료' },
};

export function chip(level, text = LEVELS[level].label) {
  return `<span class="chip chip--${level}">${icon(LEVELS[level].icon, 12)}${esc(text)}</span>`;
}

// 진행 링. 모양은 48 좌표 안에서 그리고 pathLength=100 으로 맞춰 두어, 퍼센트를 그대로 채움 길이로 씁니다.
export function progressRing(pct, level, label) {
  const done = pct >= 100;
  return `<div class="ring ring--${level}${done ? ' is-done' : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(label)}">
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle class="ring-track" cx="24" cy="24" r="19" pathLength="100"/>
      <circle class="ring-fill" cx="24" cy="24" r="19" pathLength="100" stroke-dasharray="${pct} 100" transform="rotate(-90 24 24)"/>
    </svg>
    <span class="ring-num num">${pct}%</span>
  </div>`;
}

// pct 가 null 이면 "측정 전"(연결된 할 일이 없는 계획)입니다. showPct=false 이면 막대만 그립니다.
export function progressBar(pct, level, label, showPct = true) {
  const known = pct !== null;
  const now = known ? `aria-valuenow="${pct}"` : 'aria-valuetext="측정 전"';
  return `<div class="progress-row">
    <div class="bar bar--${level}" role="progressbar" aria-valuemin="0" aria-valuemax="100" ${now} aria-label="${esc(label)}"><div class="bar-fill" style="width:${known ? pct : 0}%"></div></div>
    ${showPct ? `<span class="pct num">${known ? `${pct}%` : '측정 전'}</span>` : ''}
  </div>`;
}

// ── 모달 공통(할 일·계획·비밀번호·관리자 확인 모달이 함께 씁니다) ──
// .modal-backdrop 은 css/auth.css 에 있습니다. Esc 닫기·바깥 클릭 닫기·포커스 가두기(Tab 순환)를
// 여기서 한 번만 구현해 어느 모달에서 열어도 같은 접근성 동작을 보장합니다(DESIGN.md 8절).
let activeModal = null;

function trapFocus(container) {
  function onKeydown(e) {
    if (e.key !== 'Tab') return;
    const items = [...container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  container.addEventListener('keydown', onKeydown);
  return () => container.removeEventListener('keydown', onKeydown);
}

export function closeModal() {
  if (!activeModal) return;
  const { back, onKeydown, untrap } = activeModal;
  back.remove();
  document.removeEventListener('keydown', onKeydown);
  untrap();
  activeModal = null;
}

// html: 모달 카드 전체(.modal-card 또는 .auth-card 를 포함한 문자열). focusSelector 가 없으면
// 모달 안의 첫 입력·버튼에 포커스를 둡니다.
export function openModal(html, focusSelector) {
  closeModal();
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = html;
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) closeModal(); });
  const onKeydown = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', onKeydown);
  const untrap = trapFocus(back);
  activeModal = { back, onKeydown, untrap };
  (focusSelector ? back.querySelector(focusSelector) : back.querySelector('input, textarea, button'))?.focus();
  return back;
}

// 토스트: 하단 중앙, 3초 뒤 사라집니다. 알림 영역(role="status")은 처음 한 번만 만듭니다.
export function showToast(message) {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    host.setAttribute('role', 'status');
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  host.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
