// 할 일 만들기·수정·삭제 모달(PRD P0-1, P0-2). 제목·수행일·메모와, 연결할 계획을 체크리스트로 고릅니다
// (마우스로 끌지 않아도 되는 키보드 대안, PRD P0-1 "저장 전에 연결 방식을 반드시 고릅니다"는 0개 이상 선택도 허용해
// "개별 할 일"을 그대로 표현합니다).
import { icon } from './icons.js';
import { esc, chip, showToast, openModal, closeModal } from './ui.js';
import { getState, createTask, updateTask, updateTaskLinks, deleteTask } from './state.js';

const LEVEL_OF = { yearly: 'year', monthly: 'month', weekly: 'week' };
const LEVEL_RANK = { week: 0, month: 1, year: 2 };

const mountModal = openModal;

function planCheckList(plans, linkedIds) {
  const sorted = [...plans].sort((a, b) => LEVEL_RANK[LEVEL_OF[a.plan_type]] - LEVEL_RANK[LEVEL_OF[b.plan_type]]);
  if (!sorted.length) return '<p class="empty-text">아직 만든 계획이 없어요. 계획을 먼저 만들면 여기서 연결할 수 있어요(연결 없이도 저장할 수 있어요).</p>';
  return `<div class="check-list" role="group" aria-label="연결할 계획">${sorted.map((p) => `
    <label class="check-item">
      <input type="checkbox" name="plan" value="${esc(p.id)}" ${linkedIds.has(p.id) ? 'checked' : ''}>
      ${chip(LEVEL_OF[p.plan_type])}<span>${esc(p.title)}</span>
    </label>`).join('')}</div>`;
}

function setError(back, message) {
  const box = back.querySelector('#task-error');
  box.hidden = !message;
  box.querySelector('span').textContent = message || '';
}

export function openTaskModal(task = null) {
  const s = getState();
  const linkedIds = new Set(task ? s.links.filter((l) => l.task_id === task.id).map((l) => l.plan_id) : []);
  const isEdit = Boolean(task);

  const back = mountModal(`<div class="modal-card" role="dialog" aria-modal="true" aria-label="${isEdit ? '할 일 수정' : '새 할 일'}">
    <div class="modal-title">${isEdit ? '할 일 수정' : '새 할 일'}</div>
    <form id="task-form" novalidate>
      <div class="field">
        <div class="field-label-row">
          <label class="field-label" for="task-title">제목</label>
          <button type="button" class="icon-btn icon-btn--favorite" id="task-favorite" aria-pressed="${task?.is_favorite ? 'true' : 'false'}" aria-label="${task?.is_favorite ? '중요 표시 해제' : '중요 표시'}">${icon('heart', 16)}</button>
        </div>
        <input class="field-input" id="task-title" maxlength="100" required value="${esc(task?.title ?? '')}">
      </div>
      <div class="field">
        <label class="field-label" for="task-due">수행일(선택)</label>
        <input class="field-input" id="task-due" type="date" value="${task?.due_date ?? ''}">
      </div>
      <div class="field">
        <label class="field-label" for="task-memo">메모(선택)</label>
        <textarea class="field-input field-textarea" id="task-memo">${esc(task?.memo ?? '')}</textarea>
      </div>
      <div class="field">
        <span class="field-label">연결할 계획(0개 이상, 없으면 개별 할 일)</span>
        ${planCheckList(s.plans, linkedIds)}
      </div>
      <div class="field-error" id="task-error" hidden>${icon('triangle-alert', 15)}<span></span></div>
      <div class="modal-actions">
        ${isEdit ? `<button type="button" class="btn btn-ghost" id="task-delete">${icon('trash', 16)}<span>삭제</span></button>` : ''}
        <button type="button" class="btn btn-ghost" id="task-cancel">취소</button>
        <button type="submit" class="btn btn-primary">${isEdit ? '저장' : '만들기'}</button>
      </div>
    </form>
  </div>`, '#task-title');

  back.querySelector('#task-cancel').addEventListener('click', closeModal);
  back.querySelector('#task-delete')?.addEventListener('click', () => confirmDeleteTask(task));
  back.querySelector('#task-favorite').addEventListener('click', () => {
    const btn = back.querySelector('#task-favorite');
    const next = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(next));
    btn.setAttribute('aria-label', next ? '중요 표시 해제' : '중요 표시');
  });
  back.querySelector('#task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = back.querySelector('#task-title').value.trim();
    const due_date = back.querySelector('#task-due').value || null;
    const memo = back.querySelector('#task-memo').value.trim() || null;
    const is_favorite = back.querySelector('#task-favorite').getAttribute('aria-pressed') === 'true';
    const planIds = [...back.querySelectorAll('input[name="plan"]:checked')].map((i) => i.value);
    setError(back, '');
    if (!title) return setError(back, '제목을 입력해 주세요.');
    if (title.length > 100) return setError(back, '제목은 100자 이내로 써 주세요.');
    try {
      if (isEdit) {
        await updateTask(task.id, { title, due_date, memo, is_favorite });
        await updateTaskLinks(task.id, planIds);
        showToast('할 일을 수정했어요.');
      } else {
        await createTask({ title, due_date, memo, planIds, is_favorite });
        showToast('할 일을 만들었어요.');
      }
      closeModal();
    } catch (err) {
      setError(back, err.message);
    }
  });
}

export function confirmDeleteTask(task) {
  const back = mountModal(`<div class="auth-card" role="alertdialog" aria-modal="true" aria-label="할 일 삭제">
    <div class="auth-status-title">"${esc(task.title)}"을(를) 지울까요?</div>
    <p class="auth-status-text">되돌릴 수 없어요. 연결된 계획의 진행률도 다시 계산돼요.</p>
    <div class="auth-status-actions">
      <button type="button" class="btn btn-outline" id="del-cancel">취소</button>
      <button type="button" class="btn btn-primary" id="del-confirm">지우기</button>
    </div>
  </div>`, '#del-cancel');
  back.querySelector('#del-cancel').addEventListener('click', closeModal);
  back.querySelector('#del-confirm').addEventListener('click', async () => {
    try {
      await deleteTask(task.id);
      closeModal();
      showToast('할 일을 지웠어요.');
    } catch (err) {
      showToast(err.message);
    }
  });
}
