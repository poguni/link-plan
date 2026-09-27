-- 링크 플랜 — 02. RLS·권한·진행률 뷰
-- 근거: PRD.md 5-4. 01_schema.sql 을 먼저 실행한 뒤에 실행합니다(private.is_approved() 가 필요합니다).
-- 이 파일은 PRD 원문 SQL 그대로입니다(review 결과 문제를 찾지 못했습니다).

-- 1) RLS 켜기
alter table public.plans enable row level security;
alter table public.tasks enable row level security;
alter table public.task_plan_links enable row level security;
alter table public.profiles enable row level security;

-- 2) client 역할의 권한을 회수하고, authenticated에게 필요한 권한만 부여 (anon은 권한 없음)
revoke all on table
  public.plans, public.tasks, public.task_plan_links, public.profiles
  from anon, authenticated;

grant select, insert, update, delete on table
  public.plans, public.tasks to authenticated;
grant select, insert, delete on table
  public.task_plan_links to authenticated;
grant select on table public.profiles to authenticated;

-- 3) plans 정책: 본인 행이고 승인된 사용자일 때만
create policy plans_select_own on public.plans
  for select to authenticated
  using ((select auth.uid()) = user_id and (select private.is_approved()));
create policy plans_insert_own on public.plans
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.is_approved()));
create policy plans_update_own on public.plans
  for update to authenticated
  using ((select auth.uid()) = user_id and (select private.is_approved()))
  with check ((select auth.uid()) = user_id and (select private.is_approved()));
create policy plans_delete_own on public.plans
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select private.is_approved()));

-- 4) tasks 정책
create policy tasks_select_own on public.tasks
  for select to authenticated
  using ((select auth.uid()) = user_id and (select private.is_approved()));
create policy tasks_insert_own on public.tasks
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.is_approved()));
create policy tasks_update_own on public.tasks
  for update to authenticated
  using ((select auth.uid()) = user_id and (select private.is_approved()))
  with check ((select auth.uid()) = user_id and (select private.is_approved()));
create policy tasks_delete_own on public.tasks
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select private.is_approved()));

-- 5) task_plan_links 정책 (select, insert, delete만)
create policy links_select_own on public.task_plan_links
  for select to authenticated
  using ((select auth.uid()) = user_id and (select private.is_approved()));
create policy links_insert_own on public.task_plan_links
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.is_approved()));
create policy links_delete_own on public.task_plan_links
  for delete to authenticated
  using ((select auth.uid()) = user_id and (select private.is_approved()));

-- 6) profiles 정책: 자기 행 읽기만 (쓰기 정책 없음)
create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);

-- 7) 진행률 뷰: security_invoker로 위 RLS(승인 조건 포함)를 그대로 따르게 함
create view public.plan_progress
with (security_invoker = true) as
with tree as (
  select id as plan_id, id as member_id from public.plans          -- 자기 자신
  union all
  select parent_id, id from public.plans where parent_id is not null  -- 하위 계획
  union all
  select g.parent_id, p.id                                             -- 하위의 하위 계획
  from public.plans p
  join public.plans g on g.id = p.parent_id
  where g.parent_id is not null
)
select
  t.plan_id,
  count(distinct l.task_id) as total_tasks,
  count(distinct l.task_id) filter (where k.status = 'done') as done_tasks
from tree t
left join public.task_plan_links l on l.plan_id = t.member_id
left join public.tasks k on k.id = l.task_id
group by t.plan_id;

revoke all on table public.plan_progress from anon, authenticated;
grant select on table public.plan_progress to authenticated;
