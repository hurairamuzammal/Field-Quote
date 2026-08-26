-- Invite Set Password must activate the profile even when GoTrue already
-- stored a placeholder encrypted_password on createUser (empty check missed it).
-- Admin-deactivated staff stay inactive: they are banned, so this does not reopen them.

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
    set active = true
    where id = new.id
      and active = false;
  end if;

  return new;
end;
$$;
