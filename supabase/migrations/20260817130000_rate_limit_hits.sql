-- Edge-function rate limiter (security item 5).
-- Service-role / security-definer writes only. No client policies = deny via RLS.

create table public.rate_limit_hits (
  key text not null,
  window_start timestamptz not null,
  hit_count integer not null default 1 check (hit_count > 0),
  primary key (key, window_start)
);

comment on table public.rate_limit_hits is
  'IP+route counters for edge functions. Not for Bubble/PostgREST clients.';

alter table public.rate_limit_hits enable row level security;

revoke all on table public.rate_limit_hits from anon, authenticated;
grant all on table public.rate_limit_hits to service_role;

create or replace function public.hit_rate_limit(
  p_key text,
  p_window_start timestamptz,
  p_limit integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  if p_key is null or length(trim(p_key)) = 0 or p_limit is null or p_limit < 1 then
    return coalesce(p_limit, 0) + 1;
  end if;

  insert into public.rate_limit_hits (key, window_start, hit_count)
  values (trim(p_key), p_window_start, 1)
  on conflict (key, window_start)
  do update set hit_count = public.rate_limit_hits.hit_count + 1
  returning hit_count into new_count;

  return new_count;
end;
$$;

revoke all on function public.hit_rate_limit(text, timestamptz, integer) from public;
revoke all on function public.hit_rate_limit(text, timestamptz, integer) from anon, authenticated;
grant execute on function public.hit_rate_limit(text, timestamptz, integer) to service_role;
