-- §7.3: "Handles checkout.session.completed … and checkout.session.expired".
--
-- Expiry was being acknowledged with a bare 200 and no record, so an abandoned
-- checkout left no trace: the quote sits at `viewed` forever and the admin has no
-- idea the customer tried to pay. This table is the trace.
--
-- Deliberately NOT `payments`: no money moved. Append-only like payments/job_events
-- so it stays trustworthy, and unique on stripe_event_id so a replayed expiry event
-- is a no-op exactly like a replayed completion.

create table public.checkout_attempts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  kind text not null check (kind in ('deposit', 'final')),
  status text not null check (status in ('expired')),
  amount numeric(12,2),
  currency text check (currency is null or char_length(currency) = 3),
  stripe_session_id text,
  stripe_event_id text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create index checkout_attempts_quote_created_idx
  on public.checkout_attempts(quote_id, created_at desc);

alter table public.checkout_attempts enable row level security;

-- Admin-only, same as payments. No technician policy, no anon policy.
create policy admin_all on public.checkout_attempts for all to authenticated
  using (public.auth_role() = 'admin')
  with check (public.auth_role() = 'admin');

create or replace function public.checkout_attempts_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'checkout_attempts is append-only'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists checkout_attempts_no_update_delete on public.checkout_attempts;

create trigger checkout_attempts_no_update_delete
before update or delete on public.checkout_attempts
for each row
execute function public.checkout_attempts_append_only();

comment on table public.checkout_attempts is
  'Abandoned Stripe Checkout sessions (§7.3 checkout.session.expired). Append-only; no money state.';
