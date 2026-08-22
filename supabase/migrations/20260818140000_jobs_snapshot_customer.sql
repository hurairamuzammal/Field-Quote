-- Technician job cards need name/phone/address without reading quotes/requests.
-- RLS has no technician policy on those tables (and negative tests forbid nested reads).
-- Snapshot customer fields onto jobs at insert time (same pattern as quote line prices).

alter table public.jobs
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists customer_email text,
  add column if not exists customer_address text,
  add column if not exists work_summary text;

update public.jobs j
set
  customer_name = r.customer_name,
  customer_phone = r.customer_phone,
  customer_email = r.customer_email,
  customer_address = r.customer_address,
  work_summary = r.description
from public.quotes q
join public.requests r on r.id = q.request_id
where q.id = j.quote_id
  and (
    j.customer_name is null
    or j.customer_phone is null
    or j.customer_email is null
    or j.customer_address is null
    or j.work_summary is null
  );

alter table public.jobs
  alter column customer_name set not null,
  alter column customer_phone set not null,
  alter column customer_email set not null,
  alter column customer_address set not null,
  alter column work_summary set not null;

create or replace function public.jobs_snapshot_customer_from_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  select
    r.customer_name,
    r.customer_phone,
    r.customer_email,
    r.customer_address,
    r.description
  into rec
  from public.quotes q
  join public.requests r on r.id = q.request_id
  where q.id = new.quote_id;

  if rec is null then
    raise exception 'Cannot create job: quote/request not found for quote_id %', new.quote_id;
  end if;

  new.customer_name := rec.customer_name;
  new.customer_phone := rec.customer_phone;
  new.customer_email := rec.customer_email;
  new.customer_address := rec.customer_address;
  new.work_summary := rec.description;
  return new;
end;
$$;

drop trigger if exists jobs_snapshot_customer on public.jobs;
create trigger jobs_snapshot_customer
  before insert on public.jobs
  for each row execute function public.jobs_snapshot_customer_from_request();

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
    new.created_at is distinct from old.created_at or
    new.customer_name is distinct from old.customer_name or
    new.customer_phone is distinct from old.customer_phone or
    new.customer_email is distinct from old.customer_email or
    new.customer_address is distinct from old.customer_address or
    new.work_summary is distinct from old.work_summary
  ) then
    raise exception 'Technicians may update only job status and completion notes';
  end if;

  return new;
end;
$$;
