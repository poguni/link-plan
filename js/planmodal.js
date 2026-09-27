// 계획(연간·월간·주간) 만들기·수정·삭제 모달(PRD P0-5, P0-6).
// 상위 계획 규칙(단계 건너뜀 금지·순환 금지)은 layout.js 의 checkPlanParent 로 먼저 걸러 토스트로 보여 주고,
// 최종 기준은 서버 트리거(check_plan_parent, 01_schema.sql)입니다.
import { icon } from './icons.js';
import { esc, showToast } from './ui.js';
import { getState, createPlan, updatePlan, deletePlan } from './state.js';
import { checkPlanParent } from './layout.js';
import { defaultPeriodFor } from './period.js';

const TYPE_LABEL = { yearly: '연간 목표', monthly: '월간 계획', weekly: '주간 계획' };
const PARENT_TYPE = { weekly: 'monthly', monthly: 'yearly' };

let onCloseKeydown = null;

function closeModal() {
  document.querySelector('.modal-backdrop')?.remove();
  if (onCloseKeydown) { document.removeEventListener('keydown', onCloseKeydown); onCloseKeydown = null; }
}

function mountModal(html, focusSelector) {
  closeModal();
  const back = document.createElement('div');
  back.className = 'modal-backdrop';
  back.innerHTML = html;
  document.body.appendChild(back);
  back.addEventListener('click', (e) => { if (e.target === back) closeModal(); });
  onCloseKeydown = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', onCloseKeydown);
  back.querySelector(focusSelector)?.focus();
  return back;
}

function parentField(planType, plans, currentParentId) {
  const parentType = PARENT_TYPE[planType];
  if (!parentType) return ''; // 연간 목표는 상위가 없습니다.
  const options = plans.filter((p) => p.plan_type === parentType)
    .map((p) => `<option value="${esc(p.id)}" ${p.id === currentParentId ? 'selected' : ''}>${esc(p.title)}</option>`).join('');
  return `<div class="field">
    <label class="field-label" for="plan-parent">상위 계획(${TYPE_LABEL[parentType]}, 선택)</label>
    <select class="field-input" id="plan-parent"><option value="">없음</option>${options}</select>
  </div>`;
}

function setError(back, message) {
  const box = back.querySelector('#plan-error');
  box.hidden = !message;
  box.querySelector('span').textContent = message || '';
}

// plan: 수정 대상(계획 객체) 또는 null(새로 만들기). opts: { planType, anchor, parentId } — 새로 만들 때만 씁니다.
export function openPlanModal(plan = null, opts = {}) {
  const s = getState();
  const planType = plan?.plan_type ?? opts.planType;
  const isEdit = Boolean(plan);
  const period = plan ? { start: plan.period_start, end: plan.period_end } : defaultPeriodFor(planType, opts.anchor ?? new Date());
  const currentParentId = plan ? plan.parent_id : (opts.parentId ?? null);

  const back = mountModal(`<div class="modal-card" role="dialog" aria-modal="true" aria-label="${isEdit ? '계획 수정' : '계획 만들기'}">
    <div class="modal-title">${isEdit ? `${TYPE_LABEL[planType]} 수정` : `새 ${TYPE_LABEL[planType]}`}</div>
    <form id="plan-form" novalidate>
      <div class="field">
        <label class="field-label" for="plan-title">제목</label>
        <input class="field-input" id="plan-title" maxlength="100" required value="${esc(plan?.title ?? '')}">
      </div>
      <div class="field">
        <label class="field-label" for="plan-start">시작일</label>
        <input class="field-input" id="plan-start" type="date" required value="${period.start}">
      </div>
      <div class="field">
        <label class="field-label" for="plan-end">종료일</label>
        <input class="field-input" id="plan-end" type="date" required value="${period.end}">
      </div>
      ${parentField(planType, s.plans, currentParentId)}
      <div class="field-error" id="plan-error" hidden>${icon('triangle-alert', 15)}<span></span></div>
      <div class="modal-actions">
        ${isEdit ? `<button type="button" class="btn btn-ghost" id="plan-delete">${icon('trash', 16)}<span>삭제</span></button>` : ''}
        <button type="button" class="btn btn-ghost" id="plan-cancel">취소</button>
        <button type="submit" class="btn btn-primary">${isEdit ? '저장' : '만들기'}</button>
      </div>
    </form>
  </div>`, '#plan-title');

  back.querySelector('#plan-cancel').addEventListener('click', closeModal);
  back.querySelector('#plan-delete')?.addEventListener('click', () => confirmDeletePlan(plan));
  back.querySelector('#plan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = back.querySelector('#plan-title').value.trim();
    const period_start = back.querySelector('#plan-start').value;
    const period_end = back.querySelector('#plan-end').value;
    const parentSelect = back.querySelector('#plan-parent');
    const parent_id = parentSelect ? (parentSelect.value || null) : null;
    setError(back, '');
    if (!title) return setError(back, '제목을 입력해 주세요.');
    if (title.length > 100) return setError(back, '제목은 100자 이내로 써 주세요.');
    if (period_end < period_start) return setError(back, '종료일이 시작일보다 빠를 수 없어요.');
    const check = checkPlanParent({ id: plan?.id ?? '(new)', plan_type: planType }, parent_id, s.plans);
    if (!check.ok) return setError(back, check.reason);
    try {
      if (isEdit) {
        await updatePlan(plan.id, { title, period_start, period_end, parent_id });
        showToast('계획을 수정했어요.');
      } else {
        await createPlan({ plan_type: planType, title, period_start, period_end, parent_id });
        showToast('계획을 만들었어요.');
      }
      closeModal();
    } catch (err) {
      setError(back, err.message);
    }
  });
}

function confirmDeletePlan(plan) {
  const back = mountModal(`<div class="auth-card" role="alertdialog" aria-modal="true" aria-label="계획 삭제">
    <div class="auth-status-title">"${esc(plan.title)}"을(를) 지울까요?</div>
    <p class="auth-status-text">연결된 할 일과 하위 계획은 남고, 연결만 해제돼요. 되돌릴 수 없어요.</p>
    <div class="auth-status-actions">
      <button type="button" class="btn btn-outline" id="del-cancel">취소</button>
      <button type="button" class="btn btn-primary" id="del-confirm">지우기</button>
    </div>
  </div>`, '#del-cancel');
  back.querySelector('#del-cancel').addEventListener('click', closeModal);
  back.querySelector('#del-confirm').addEventListener('click', async () => {
    try {
      await deletePlan(plan.id);
      closeModal();
      showToast('계획을 지웠어요.');
    } catch (err) {
      showToast(err.message);
    }
  });
}
