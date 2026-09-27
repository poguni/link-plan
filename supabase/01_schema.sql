-- 링크 플랜 — 01. 스키마 (테이블·트리거)
-- 근거: PRD.md 5-3(테이블), 6-8(user_settings). Supabase SQL Editor에서 02, 03, 04 보다 먼저, 한 번만 실행합니다.
--
-- [PRD와 다르게 정리한 부분 — 사용자 확인 완료]
-- 1) "0) 기본 권한 잠그기"는 PRD 5-2 문서상 02(RLS 파일) 에 있지만, PRD 5-2 본문이 "테이블을 만들기 전에 한 번만
--    실행"하라고 못박고 있어 이 파일의 맨 앞으로 옮겼습니다. alter default privileges 는 이후 새로 만드는 객체에만
--    적용되므로, 테이블을 만들기 전에 먼저 실행해야 뜻이 있습니다.
-- 2) check_plan_parent() 의 상위 계획 조회에 user_id 조건을 추가했습니다(PRD 원문에는 없음). 복합 외래 키가 있어
--    다른 사용자의 계획을 상위로 쓰는 것 자체는 이미 막혀 있지만(보안 구멍이 아님), 원문 그대로면 트리거의 친절한
--    한국어 오류 대신 원시 외래 키 위반 오류가 날 수 있어 사용자 확인을 받고 고쳤습니다.
-- 3) tasks.completed_at 을 서버가 자동으로 기록하는 트리거를 추가했습니다(PRD 원문에는 없음, 사용자 확인 완료).
--    할 일이 완료로 바뀌면 트리거가 완료 시각을 넣고, 다른 상태로 돌아가면 비웁니다(PRD P0-3). 클라이언트가 무엇을
--    보내든 서버가 항상 다시 계산하므로, js/api.js 는 이제 completed_at 을 직접 계산해 보내지 않아도 됩니다.

-- 0) 기본 권한 잠그기 (프로젝트 전체에 적용, 테이블을 만들기 전에 한 번만 실행)
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public;

-- 1) enum 타입
create type public.task_status as enum ('todo', 'doing', 'done');
create type public.plan_type as enum ('weekly', 'monthly', 'yearly');

-- 2) 계획 (주간·월간·연간)
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  plan_type public.plan_type not null,
  title text not null check (char_length(title) between 1 and 100),
  period_start date not null,
  period_end date not null,
  parent_id uuid,
  created_at timestamptz not null default now(),
  check (period_end >= period_start),
  unique (id, user_id),
  foreign key (parent_id, user_id) references public.plans (id, user_id)
    on delete set null (parent_id)
);

-- 3) 할 일
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  memo text,
  due_date date,
  status public.task_status not null default 'todo',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

-- 4) 할 일-계획 연결 (연결이 하나도 없는 할 일 = 독립 할 일)
create table public.task_plan_links (
  task_id uuid not null,
  plan_id uuid not null,
  user_id uuid not null default auth.uid(),
  primary key (task_id, plan_id),
  foreign key (task_id, user_id) references public.tasks (id, user_id) on delete cascade,
  foreign key (plan_id, user_id) references public.plans (id, user_id) on delete cascade
);

-- 5) RLS 정책이 쓰는 열과 조인 열에 인덱스
create index plans_user_id_idx on public.plans (user_id);
create index plans_parent_id_idx on public.plans (parent_id);
create index tasks_user_id_idx on public.tasks (user_id);
create index task_plan_links_user_id_idx on public.task_plan_links (user_id);
create index task_plan_links_plan_id_idx on public.task_plan_links (plan_id);

-- 6) 상위 계획 규칙: 주간→월간, 월간→연간만 허용, 하위 계획이 있으면 유형 변경 금지
create function public.check_plan_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_type public.plan_type;
begin
  if tg_op = 'UPDATE' and new.plan_type is distinct from old.plan_type then
    if exists (select 1 from public.plans where parent_id = new.id) then
      raise exception '하위 계획이 있는 계획은 유형을 바꿀 수 없습니다.';
    end if;
  end if;

  if new.parent_id is null then
    return new;
  end if;

  -- user_id 조건을 추가해, 다른 사용자의 계획을 상위로 쓰려는 시도도 여기서 걸러 친절한 메시지로 막습니다.
  select p.plan_type into parent_type
    from public.plans p
    where p.id = new.parent_id and p.user_id = new.user_id;
  if parent_type is null
     or not ((new.plan_type = 'weekly' and parent_type = 'monthly')
          or (new.plan_type = 'monthly' and parent_type = 'yearly')) then
    raise exception '허용되지 않는 상위 계획 유형입니다.';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_plan_parent() from public, anon, authenticated;

create trigger plans_check_parent
before insert or update of parent_id, plan_type on public.plans
for each row execute function public.check_plan_parent();

-- 6-1) 완료 시각 자동 기록: 완료로 바뀌면 완료 시각을 넣고, 다른 상태로 돌아가면 비웁니다(PRD P0-3).
create function public.set_task_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status is distinct from 'done') then
    new.completed_at := now();
  elsif new.status is distinct from 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

revoke execute on function public.set_task_completed_at() from public, anon, authenticated;

create trigger tasks_set_completed_at
before insert or update of status on public.tasks
for each row execute function public.set_task_completed_at();

-- 7) 프로필과 승인 확인 (5-4의 RLS 정책보다 먼저 실행)
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  approved boolean not null default false,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

-- 가입하면 프로필을 자동으로 만든다 (승인과 관리자 권한은 꺼진 상태)
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- RLS 정책이 쓰는 승인 확인 함수
create function private.is_approved()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select p.approved from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

revoke execute on function private.is_approved() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_approved() to authenticated;

-- 8) 뷰·테마 설정 (PRD 6-8, P1-10 을 앞당겨 지금 만듭니다: 여러 기기에서 같은 뷰·테마를 씁니다)
create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  theme text not null default 'clean' check (theme in ('clean', 'night', 'pastel')),
  view_mode text not null default 'board' check (view_mode in ('board', 'link')),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

revoke all on table public.user_settings from anon, authenticated;
grant select, insert, update on table public.user_settings to authenticated;

create policy settings_select_own on public.user_settings
  for select to authenticated
  using ((select auth.uid()) = user_id and (select private.is_approved()));
create policy settings_insert_own on public.user_settings
  for insert to authenticated
  with check ((select auth.uid()) = user_id and (select private.is_approved()));
create policy settings_update_own on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id and (select private.is_approved()))
  with check ((select auth.uid()) = user_id and (select private.is_approved()));
