-- Auth lock (security items 2–3):
-- * Role comes only from app_metadata.fieldquote_role (service-role invite).
-- * Invitees stay profiles.active = false until a password is stored.
-- Do not edit older migrations.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_app_meta_data ->> 'fieldquote_role', 'technician');
  requested_company uuid;
  has_password boolean;
begin
  -- Never read raw_user_meta_data.role — clients can set that on signup.
  if requested_role not in ('admin', 'technician') then
    requested_role := 'technician';
  end if;

  begin
    requested_company := nullif(new.raw_user_meta_data ->> 'company_id', '')::uuid;
  exception
    when invalid_text_representation then
      requested_company := null;
  end;

  has_password := new.encrypted_password is not null and new.encrypted_password <> '';

  insert into public.profiles (id, company_id, role, full_name, email, active)
  values (
    new.id,
    coalesce(requested_company, '00000000-0000-0000-0000-000000000001'::uuid),
    requested_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    has_password
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- First time a password is stored (invite / recovery complete).
-- Does not reactivate staff the admin already deactivated (they already had a password).
create or replace function public.handle_user_password_set()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.encrypted_password is null or old.encrypted_password = '')
     and (new.encrypted_password is not null and new.encrypted_password <> '')
     and (new.banned_until is null or new.banned_until < timezone('utc', now()))
  then
    update public.profiles
    set active = true
    where id = new.id
      and active = false;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_password_set on auth.users;
create trigger on_auth_user_password_set
  after update of encrypted_password on auth.users
  for each row
  execute function public.handle_user_password_set();

-- Existing invitees who never set a password must not keep an active profile.
update public.profiles p
set active = false
from auth.users u
where p.id = u.id
  and p.active = true
  and (u.encrypted_password is null or u.encrypted_password = '');
