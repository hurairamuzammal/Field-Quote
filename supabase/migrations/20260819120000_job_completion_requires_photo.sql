-- Technician complete requires ≥1 completion_photo. Bubble can hide the button; this is the real gate.

create or replace function public.enforce_job_completion_photo()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'completed'
     and old.status is distinct from 'completed' then
    if not exists (
      select 1
      from public.job_media m
      where m.job_id = new.id
        and m.kind = 'completion_photo'
    ) then
      raise exception 'Job cannot be completed without at least one photo'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_require_completion_photo on public.jobs;

create trigger jobs_require_completion_photo
before update of status on public.jobs
for each row
execute function public.enforce_job_completion_photo();

comment on function public.enforce_job_completion_photo() is
  'Rejects jobs.status → completed unless at least one job_media completion_photo exists.';
