-- Complete requires non-empty completion_notes (photo gate stays in 20260819120000).
-- Realtime: FULL replica identity so admin SessionKeeper sees job status/notes updates.

alter table public.jobs replica identity full;

create or replace function public.enforce_job_completion_notes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'completed'
     and old.status is distinct from 'completed' then
    if new.completion_notes is null or length(trim(new.completion_notes)) < 3 then
      raise exception 'Job cannot be completed without completion notes'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_require_completion_notes on public.jobs;

create trigger jobs_require_completion_notes
before update of status, completion_notes on public.jobs
for each row
execute function public.enforce_job_completion_notes();

comment on function public.enforce_job_completion_notes() is
  'Rejects jobs.status → completed unless completion_notes has at least 3 non-space characters.';
