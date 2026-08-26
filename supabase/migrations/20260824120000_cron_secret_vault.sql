-- Hosted Supabase cannot run: alter database postgres set app.settings.cron_secret = '...';
-- (permission denied — not a dashboard toggle; platform blocks custom database GUCs.)
--
-- Fix: store the same value in Supabase Vault (SQL editor or Dashboard → Vault).
-- After db push, run ONCE in SQL editor (replace with your real CRON_SECRET):
--
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret', 'Matches edge CRON_SECRET');
--
-- If you already created one, update instead:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'cron_secret' limit 1),
--     '<CRON_SECRET>', 'cron_secret', 'Matches edge CRON_SECRET'
--   );

create extension if not exists supabase_vault with schema vault;

create or replace function public.get_cron_secret()
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select coalesce(
    nullif(trim((
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'cron_secret'
      limit 1
    )), ''),
    nullif(trim(current_setting('app.settings.cron_secret', true)), '')
  );
$$;

comment on function public.get_cron_secret() is
  'Cron HTTP password: Vault name cron_secret first, else app.settings.cron_secret GUC (self-host).';

create or replace function public.cron_post_edge(path text)
returns bigint
language plpgsql
security definer
set search_path = public, net, vault
as $$
declare
  secret text;
  base_url text;
  req_id bigint;
begin
  secret := nullif(trim(public.get_cron_secret()), '');
  if secret is null then
    raise warning 'cron_post_edge: cron_secret unset (Vault cron_secret or app.settings.cron_secret); skip %', path;
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

create or replace function public.dispatch_send_final_invoice()
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
  if new.status is not distinct from old.status or new.status <> 'completed' then
    return new;
  end if;

  secret := nullif(trim(public.get_cron_secret()), '');
  if secret is null then
    raise warning 'dispatch_send_final_invoice: cron_secret unset; skip HTTP';
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
