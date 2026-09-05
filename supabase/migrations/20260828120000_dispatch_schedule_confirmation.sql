-- §8.1: "Customer receives a Resend confirmation with date/time and assigned tech's first name."
--
-- Scheduling is a plain PostgREST PATCH from Bubble, so the only server-side hook is a trigger.
-- Same shape as dispatch_send_final_invoice (20260820120100 / 20260824120000):
--   * secret from public.get_cron_secret() (Vault `cron_secret`, else app.settings GUC)
--   * fire-and-forget pg_net POST
--   * every failure is a WARNING, never an exception — assigning a technician must not
--     roll back because Resend or pg_net had a bad minute.
--
-- If the Vault secret is unset this no-ops with a warning; Bubble can still POST
-- send-schedule-confirmation directly with a staff JWT.

create extension if not exists pg_net;

create or replace function public.dispatch_send_schedule_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  secret text;
  base_url text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  -- Only a real (re)scheduling event: a technician and a time must both be present,
  -- and one of them must have actually changed. Status-only edits (en_route,
  -- in_progress, completed) must not re-send.
  if new.technician_id is null or new.scheduled_at is null then
    return new;
  end if;
  if new.technician_id is not distinct from old.technician_id
     and new.scheduled_at is not distinct from old.scheduled_at then
    return new;
  end if;
  if new.status in ('cancelled', 'completed') then
    return new;
  end if;

  secret := nullif(trim(public.get_cron_secret()), '');
  if secret is null then
    raise warning 'dispatch_send_schedule_confirmation: cron_secret unset; skip HTTP for job %', new.id;
    return new;
  end if;

  base_url := nullif(trim(current_setting('app.settings.functions_base_url', true)), '');
  if base_url is null then
    base_url := 'https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1';
  end if;

  begin
    perform net.http_post(
      url := rtrim(base_url, '/') || '/send-schedule-confirmation',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', secret
      ),
      body := jsonb_build_object('job_id', new.id)
    );
  exception
    when others then
      raise warning 'dispatch_send_schedule_confirmation HTTP failed: %', sqlerrm;
  end;

  return new;
end;
$$;

comment on function public.dispatch_send_schedule_confirmation() is
  'Fires send-schedule-confirmation when a job gains or changes technician_id / scheduled_at (§8.1).';

drop trigger if exists jobs_dispatch_schedule_confirmation on public.jobs;

create trigger jobs_dispatch_schedule_confirmation
after update of technician_id, scheduled_at on public.jobs
for each row
execute function public.dispatch_send_schedule_confirmation();
