-- guard_profile_self_update (20260824150000) treated a missing JWT the same as
-- a technician: auth_role() is null when auth.uid() is null, so service_role
-- updates from set-technician-active / invite / complete-password-setup raised
-- "You may update only your display name" and left profiles.active unchanged.
-- Auth-user password triggers can also carry the invitee's JWT while they are
-- still inactive — those must set setup_complete/active too.

create or replace function public.guard_profile_self_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('fieldquote.skip_profile_guard', true) = 'on' then
    return new;
  end if;

  -- Edge functions use the service_role key (no user sub). Do not block them.
  if auth.uid() is null then
    return new;
  end if;

  if public.auth_role() = 'admin' then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.company_id is distinct from old.company_id
    or new.email is distinct from old.email
    or new.active is distinct from old.active
    or new.setup_complete is distinct from old.setup_complete
    or new.id is distinct from old.id
  then
    raise exception 'You may update only your display name';
  end if;

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
    perform set_config('fieldquote.skip_profile_guard', 'on', true);
    update public.profiles
    set
      setup_complete = true,
      active = true
    where id = new.id;
  end if;

  return new;
end;
$$;
