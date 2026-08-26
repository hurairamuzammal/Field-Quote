-- Staff may read company_settings (brand + rates). Tech UI must use Get Company Brand
-- (name/logo_key only); RLS cannot hide columns. Admins already had admin_all.
-- Staff may PATCH their own profiles.full_name; a trigger blocks role/company/email/active.
-- DROP IF EXISTS: remote may already have these names from a dashboard edit or a failed retry.

drop policy if exists staff_read_company_settings on public.company_settings;
create policy staff_read_company_settings
  on public.company_settings
  for select
  to authenticated
  using (public.auth_role() in ('admin', 'technician'));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid() and active = true)
  with check (id = auth.uid() and active = true);

create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.auth_role() is distinct from 'admin' then
    if new.role is distinct from old.role
      or new.company_id is distinct from old.company_id
      or new.email is distinct from old.email
      or new.active is distinct from old.active
      or new.setup_complete is distinct from old.setup_complete
      or new.id is distinct from old.id
    then
      raise exception 'You may update only your display name';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_self_update on public.profiles;
create trigger profiles_guard_self_update
  before update on public.profiles
  for each row execute function public.guard_profile_self_update();
