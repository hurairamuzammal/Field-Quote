-- When a job becomes completed, fire send-final-invoice (async). Job update must not fail if HTTP fails.
-- Set GUCs once in SQL editor (same value as supabase secret CRON_SECRET):
--   alter database postgres set app.settings.cron_secret = '<CRON_SECRET>';
-- Optional override:
--   alter database postgres set app.settings.functions_base_url = 'https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1';
-- If cron_secret is unset, this trigger no-ops; Bubble can still POST send-final-invoice with a staff JWT.

create extension if not exists pg_net;

create or replace function public.dispatch_send_final_invoice()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  secret text;
  base_url text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if new.status is not distinct from old.status or new.status <> 'completed' then
    return new;
  end if;

  secret := nullif(trim(current_setting('app.settings.cron_secret', true)), '');
  if secret is null then
    raise warning 'dispatch_send_final_invoice: app.settings.cron_secret unset; skip HTTP';
    return new;
  end if;

  base_url := nullif(trim(current_setting('app.settings.functions_base_url', true)), '');
  if base_url is null then
    base_url := 'https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1';
  end if;

  begin
    perform net.http_post(
      url := rtrim(base_url, '/') || '/send-final-invoice',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-cron-secret', secret
      ),
      body := jsonb_build_object('job_id', new.id)
    );
  exception
    when others then
      raise warning 'dispatch_send_final_invoice HTTP failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists jobs_dispatch_final_invoice on public.jobs;

create trigger jobs_dispatch_final_invoice
after update of status on public.jobs
for each row
execute function public.dispatch_send_final_invoice();
