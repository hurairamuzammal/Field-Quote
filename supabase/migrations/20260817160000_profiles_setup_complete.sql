-- Distinguish "never set a password" from "admin disabled".
-- active = may log in. setup_complete = finished invite (had a password at least once).
-- Resend invite: setup_complete = false. Disable: setup_complete = true and active = false.

alter table public.profiles
  add column if not exists setup_complete boolean not null default false;

comment on column public.profiles.setup_complete is
  'True after the user has set a password. Stays true if the admin later deactivates them.';

-- Admins and anyone who already has a password (or is banned = was a real account).
update public.profiles p
set setup_complete = true
from auth.users u
where p.id = u.id
  and p.setup_complete = false
  and (
    p.role = 'admin'
    or (u.encrypted_password is not null and u.encrypted_password <> '')
    or (u.banned_until is not null and u.banned_until > timezone('utc', now()))
  );

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

  insert into public.profiles (id, company_id, role, full_name, email, active, setup_complete)
  values (
    new.id,
    coalesce(requested_company, '00000000-0000-0000-0000-000000000001'::uuid),
    requested_role,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    has_password,
    has_password
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create or replace function public.handle_user_password_set()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.encrypted_password is distinct from old.encrypted_password
     and new.encrypted_password is not null
     and new.encrypted_password <> ''
     and (new.banned_until is null or new.banned_until < timezone('utc', now()))
  then
    update public.profiles
    set
      setup_complete = true,
      active = true
    where id = new.id;
  end if;

  return new;
end;
$$;
