-- FieldQuote §2.5 RLS negative checks.
-- Run with a privileged database connection:
-- psql "$DATABASE_URL" -v technician_id='<auth.users UUID for technician>' -f tests/rls/negative.sql

begin;

set local role authenticated;
select set_config('request.jwt.claim.sub', :'technician_id', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if (select count(*) from public.quotes) <> 0 then
    raise exception 'RLS failure: technician can read quotes';
  end if;
  if (select count(*) from public.payments) <> 0 then
    raise exception 'RLS failure: technician can read payments';
  end if;
  if (select count(*) from public.price_book_items) <> 0 then
    raise exception 'RLS failure: technician can read price book items';
  end if;
  if (select count(*) from public.company_settings) <> 0 then
    raise exception 'RLS failure: technician can read company settings';
  end if;
  if exists (select 1 from public.jobs where technician_id is distinct from auth.uid()) then
    raise exception 'RLS failure: technician can read another technician''s job';
  end if;
end;
$$;

rollback;
