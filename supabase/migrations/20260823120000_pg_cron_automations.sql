-- §9.1–9.2 automations: pause toggle, invoice nudge flag, pg_cron daily jobs.
-- Requires app.settings.cron_secret = same value as supabase secret CRON_SECRET (see dispatch_final_invoice migration).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

alter table public.company_settings
  add column if not exists automations_paused boolean not null default false;

comment on column public.company_settings.automations_paused is
  'When true, quote-followups and daily-reminders skip sends for this company.';

alter table public.jobs
  add column if not exists invoice_nudge_exhausted boolean not null default false;

comment on column public.jobs.invoice_nudge_exhausted is
  'Set after 2 final_invoice_nudge emails; admin can follow up manually.';

create or replace function public.cron_post_edge(path text)
returns bigint
language plpgsql
security definer
set search_path = public, net
as $$
declare
  secret text;
  base_url text;
  req_id bigint;
begin
  secret := nullif(trim(current_setting('app.settings.cron_secret', true)), '');
  if secret is null then
    raise warning 'cron_post_edge: app.settings.cron_secret unset; skip %', path;
    return null;
  end if;

  base_url := nullif(trim(current_setting('app.settings.functions_base_url', true)), '');
  if base_url is null then
    base_url := 'https://chqljfdmgdtsmbbwbdyv.supabase.co/functions/v1';
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/' || trim(both '/' from path),
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', secret
    ),
    body := jsonb_build_object('source', 'pg_cron')
  ) into req_id;

  return req_id;
end;
$$;

comment on function public.cron_post_edge(text) is
  'Fire-and-forget POST to an edge function using app.settings.cron_secret.';

do $$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname in ('quote-followups-daily', 'daily-reminders-daily')
  loop
    perform cron.unschedule(jid);
  end loop;
exception
  when undefined_table then null;
  when others then null;
end;
$$;

select cron.schedule(
  'quote-followups-daily',
  '0 7 * * *',
  $$ select public.cron_post_edge('quote-followups'); $$
);

select cron.schedule(
  'daily-reminders-daily',
  '15 7 * * *',
  $$ select public.cron_post_edge('daily-reminders'); $$
);
