-- Add default company_id so that the trigger can omit it
alter table public.profiles alter column company_id set default '00000000-0000-0000-0000-000000000001';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name',''),
          coalesce(new.raw_user_meta_data->>'role','technician'))
  on conflict (id) do nothing;

  return new;
end;
$$;
