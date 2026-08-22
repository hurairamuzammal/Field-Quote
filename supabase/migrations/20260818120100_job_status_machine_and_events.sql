-- Item 18: jobs.status machine + append-only job_events (written by trigger, never by clients).

create or replace function public.enforce_job_status_transition()
returns trigger
language plpgsql
as $$
declare
  allowed boolean := false;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Forward: unscheduled → scheduled → en_route → in_progress → completed
  -- cancelled from any non-terminal; scheduled → unscheduled (admin unassign).
  if old.status = 'unscheduled' and new.status in ('scheduled', 'cancelled') then
    allowed := true;
  elsif old.status = 'scheduled' and new.status in ('en_route', 'unscheduled', 'cancelled') then
    allowed := true;
  elsif old.status = 'en_route' and new.status in ('in_progress', 'cancelled') then
    allowed := true;
  elsif old.status = 'in_progress' and new.status in ('completed', 'cancelled') then
    allowed := true;
  end if;

  if not allowed then
    raise exception 'Illegal job status transition: % → %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_enforce_status_transition on public.jobs;

create trigger jobs_enforce_status_transition
before update of status on public.jobs
for each row
execute function public.enforce_job_status_transition();

comment on function public.enforce_job_status_transition() is
  'Enforces jobs.status flow unscheduled→scheduled→en_route→in_progress→completed (plus cancelled / unassign).';

-- Log every status change. SECURITY DEFINER so technicians (no INSERT on job_events) still get a row.
create or replace function public.log_job_status_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.job_events (company_id, job_id, actor_id, from_status, to_status)
    values (new.company_id, new.id, auth.uid(), null, new.status);
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.job_events (company_id, job_id, actor_id, from_status, to_status)
    values (new.company_id, new.id, auth.uid(), old.status, new.status);
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_log_status_event on public.jobs;

create trigger jobs_log_status_event
after insert or update of status on public.jobs
for each row
execute function public.log_job_status_event();

comment on function public.log_job_status_event() is
  'Appends job_events on job insert and every status change. actor_id = auth.uid() (null for service-role webhook).';

create or replace function public.job_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'job_events is append-only'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists job_events_no_update_delete on public.job_events;

create trigger job_events_no_update_delete
before update or delete on public.job_events
for each row
execute function public.job_events_append_only();

comment on function public.job_events_append_only() is
  'Rejects UPDATE/DELETE on job_events.';
