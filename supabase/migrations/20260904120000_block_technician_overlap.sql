-- Same technician cannot hold two overlapping live jobs.
-- check_technician_conflicts() stays the assign-popup warning feed; this trigger
-- is the security boundary so a PATCH that ignores the warning still fails.

create or replace function public.enforce_technician_no_overlap()
returns trigger
language plpgsql
as $$
declare
  clash_name text;
begin
  if new.technician_id is null or new.scheduled_at is null then
    return new;
  end if;
  if new.status not in ('scheduled', 'en_route', 'in_progress') then
    return new;
  end if;

  select j.customer_name
    into clash_name
  from public.jobs j
  where j.technician_id = new.technician_id
    and j.id is distinct from new.id
    and j.scheduled_at is not null
    and j.status in ('scheduled', 'en_route', 'in_progress')
    and new.scheduled_at < j.scheduled_at + make_interval(mins => coalesce(j.duration_min, 60))
    and j.scheduled_at < new.scheduled_at + make_interval(mins => coalesce(new.duration_min, 60))
  limit 1;

  if found then
    raise exception 'This technician already has a job in that slot (%).', coalesce(clash_name, 'another customer')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_enforce_technician_no_overlap on public.jobs;

create trigger jobs_enforce_technician_no_overlap
before insert or update on public.jobs
for each row
execute function public.enforce_technician_no_overlap();

comment on function public.enforce_technician_no_overlap() is
  'Rejects overlapping scheduled/en_route/in_progress jobs for the same technician.';
