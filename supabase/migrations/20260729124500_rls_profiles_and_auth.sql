-- FieldQuote §2 / Week 1 Day 2: RLS, staff profile lifecycle, and existing-user backfill.
-- Auth is managed by Supabase Auth. These policies govern application data only.

create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and active = true;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_app_meta_data ->> 'fieldquote_role', 'technician');
begin
  -- `fieldquote_role` is app metadata, so only a server-side Auth Admin action may set it.
  if requested_role not in ('admin', 'technician') then
    requested_role := 'technician';
  end if;

  insert into public.profiles (id, company_id, role, full_name, email)
  values (
    new.id,
    '00000000-0000-0000-0000-000000000001',
    requested_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill the two accounts created before the trigger was installed.
-- `admin@example.com` is the designated test admin; Huraira is the designated test technician.
insert into public.profiles (id, company_id, role, full_name, email)
select
  id,
  '00000000-0000-0000-0000-000000000001',
  case when email = 'admin@example.com' then 'admin' else 'technician' end,
  case
    when email = 'admin@example.com' then 'FieldQuote Admin'
    else 'Huraira Muzammel'
  end,
  email
from auth.users
where email in ('admin@example.com', 'huraira.muzammel@gmail.com')
on conflict (id) do update set
  company_id = excluded.company_id,
  role = excluded.role,
  full_name = excluded.full_name,
  email = excluded.email,
  active = true;

-- Administrators can manage every domain record. Technicians receive only the narrow policies below.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'company_settings', 'price_book_items', 'requests', 'request_media',
    'quotes', 'quote_line_items', 'jobs', 'job_events', 'job_media', 'payments',
    'email_log', 'chat_sessions', 'chat_messages', 'assistant_actions', 'waitlist'
  ]
  loop
    execute format(
      'create policy admin_all on public.%I for all to authenticated using (public.auth_role() = ''admin'') with check (public.auth_role() = ''admin'')',
      table_name
    );
  end loop;
end;
$$;

-- A signed-in staff member may read their own role/profile for login routing, but cannot self-promote or reactivate.
create policy profiles_read_own
  on public.profiles for select to authenticated
  using (id = auth.uid() and active = true);

-- Technicians can see only jobs assigned to them. Prices, requests, quotes, payments, and settings have no technician policy.
create policy technician_read_assigned_jobs
  on public.jobs for select to authenticated
  using (technician_id = auth.uid() and public.auth_role() = 'technician');

create policy technician_update_assigned_jobs
  on public.jobs for update to authenticated
  using (technician_id = auth.uid() and public.auth_role() = 'technician')
  with check (technician_id = auth.uid() and public.auth_role() = 'technician');

-- This trigger is the database-side column guard for technician job updates.
-- Admins retain full scheduling/assignment control through their admin policy.
create or replace function public.guard_technician_job_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() = 'technician' and (
    new.company_id is distinct from old.company_id or
    new.quote_id is distinct from old.quote_id or
    new.technician_id is distinct from old.technician_id or
    new.scheduled_at is distinct from old.scheduled_at or
    new.duration_min is distinct from old.duration_min or
    new.created_at is distinct from old.created_at
  ) then
    raise exception 'Technicians may update only job status and completion notes';
  end if;

  return new;
end;
$$;

create trigger jobs_guard_technician_update
  before update on public.jobs
  for each row execute function public.guard_technician_job_update();

create policy technician_read_assigned_job_events
  on public.job_events for select to authenticated
  using (
    public.auth_role() = 'technician'
    and exists (
      select 1 from public.jobs
      where jobs.id = job_events.job_id
        and jobs.technician_id = auth.uid()
    )
  );

create policy technician_read_assigned_job_media
  on public.job_media for select to authenticated
  using (
    public.auth_role() = 'technician'
    and exists (
      select 1 from public.jobs
      where jobs.id = job_media.job_id
        and jobs.technician_id = auth.uid()
    )
  );

create policy technician_add_assigned_job_media
  on public.job_media for insert to authenticated
  with check (
    public.auth_role() = 'technician'
    and exists (
      select 1 from public.jobs
      where jobs.id = job_media.job_id
        and jobs.technician_id = auth.uid()
    )
  );

-- The landing waitlist is the only anonymous write. Public requests and payments go through validated Edge Functions.
create policy anon_join_waitlist
  on public.waitlist for insert to anon
  with check (company_id = '00000000-0000-0000-0000-000000000001');

