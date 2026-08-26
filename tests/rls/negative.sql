-- FieldQuote §2.5 RLS negative checks.
-- Run with a privileged database connection:
-- psql "$DATABASE_URL" -v technician_id='<auth.users UUID for an active technician>' -f tests/rls/negative.sql

begin;

-- Remember inactive profile (if any) before becoming the technician JWT.
do $$
declare
  inactive uuid;
begin
  select id into inactive from public.profiles where active = false limit 1;
  if inactive is not null then
    perform set_config('my.inactive_id', inactive::text, true);
  end if;
end;
$$;

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
  if (select count(*) from public.company_settings) <> 1 then
    raise exception 'RLS failure: technician should read the company settings row (brand)';
  end if;
  update public.company_settings set name = name;
  if found then
    raise exception 'RLS failure: technician updated company_settings';
  end if;

  update public.profiles set full_name = full_name where id = auth.uid();
  if not found then
    raise exception 'RLS failure: technician cannot update own full_name';
  end if;
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'RLS failure: technician changed own role';
  exception
    when others then
      if SQLERRM not like '%You may update only your display name%' then
        raise;
      end if;
  end;
  if exists (select 1 from public.jobs where technician_id is distinct from auth.uid()) then
    raise exception 'RLS failure: technician can read another technician''s job';
  end if;
  if exists (
    select 1
    from public.jobs j
    inner join public.quotes q on q.id = j.quote_id
  ) then
    raise exception 'RLS failure: technician nested-read quotes via jobs join';
  end if;
  if exists (
    select 1
    from public.jobs
    where technician_id = auth.uid()
      and customer_address is null
  ) then
    raise exception 'RLS failure: assigned jobs missing customer_address snapshot';
  end if;

  if exists (select 1 from public.jobs where technician_id = auth.uid()) then
    begin
      update public.jobs
      set technician_id = gen_random_uuid()
      where technician_id = auth.uid();
      raise exception 'RLS failure: technician changed technician_id';
    exception
      when others then
        if SQLERRM not like '%Technicians may update only%' then
          raise;
        end if;
    end;

    begin
      update public.jobs
      set scheduled_at = timezone('utc', now())
      where technician_id = auth.uid();
      raise exception 'RLS failure: technician changed scheduled_at';
    exception
      when others then
        if SQLERRM not like '%Technicians may update only%' then
          raise;
        end if;
    end;
  end if;
end;
$$;

-- Inactive staff: auth_role() is null → no admin_all, no own-profile read, no jobs.
do $$
declare
  inactive text := current_setting('my.inactive_id', true);
begin
  if inactive is null or inactive = '' then
    return;
  end if;
  perform set_config('request.jwt.claim.sub', inactive, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  if (select count(*) from public.profiles) <> 0 then
    raise exception 'RLS failure: inactive user can read profiles';
  end if;
  if (select count(*) from public.jobs) <> 0 then
    raise exception 'RLS failure: inactive user can read jobs';
  end if;
  if (select count(*) from public.quotes) <> 0 then
    raise exception 'RLS failure: inactive user can read quotes';
  end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

do $$
begin
  if (select count(*) from public.quotes) <> 0 then
    raise exception 'RLS failure: anon can read quotes';
  end if;
  if (select count(*) from public.profiles) <> 0 then
    raise exception 'RLS failure: anon can read profiles';
  end if;
  if (select count(*) from public.jobs) <> 0 then
    raise exception 'RLS failure: anon can read jobs';
  end if;
  if (select count(*) from public.payments) <> 0 then
    raise exception 'RLS failure: anon can read payments';
  end if;

  begin
    insert into public.profiles (id, company_id, role, full_name, email)
    values (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000001',
      'admin',
      'Anon Admin',
      'anon-admin@example.com'
    );
    raise exception 'RLS failure: anon inserted a profile';
  exception
    when others then
      if SQLERRM like 'RLS failure:%' then
        raise;
      end if;
  end;
end;
$$;

rollback;
