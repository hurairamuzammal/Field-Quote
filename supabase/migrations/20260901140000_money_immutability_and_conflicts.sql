-- Hardening pass: the three DB-side holes found in the 2026-09-01 review, plus
-- the double-booking check §8.1 asks for.
--
--  1. payments append-only          (CLAUDE.md rule 11 / §13 R3)
--  2. quote money frozen after send (§7.1 — the customer pays what the email said)
--  3. quote_line_items.overridden computed, not client-asserted (§6.2)
--  4. check_technician_conflicts() RPC for the assign popup (§8.1)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. payments is append-only.
--
-- `job_events` and `checkout_attempts` already have this guard; `payments` — the
-- one table §13 R3 is actually about — did not, while `admin_all` grants FOR ALL
-- to any admin JWT. An admin token could PATCH or DELETE a payment row straight
-- through PostgREST. Only the webhook writes money, and it only ever INSERTs.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.payments_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'payments is append-only (money state is written by stripe-webhook only)'
    using errcode = 'check_violation';
end;
$$;

drop trigger if exists payments_no_update_delete on public.payments;

create trigger payments_no_update_delete
before update or delete on public.payments
for each row
execute function public.payments_append_only();

comment on function public.payments_append_only() is
  'Rejects UPDATE/DELETE on payments. §13 R3: Stripe is the only source of money state.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. A sent quote's money is the document the customer agreed to.
--
-- enforce_quote_line_items_draft_only() already freezes the lines. The parent
-- totals were still PATCHable, and create-checkout reads deposit_amount live at
-- Accept time — so editing a sent quote's total silently changed what the
-- customer was charged relative to the email in front of them.
--
-- The recalc trigger (sync_quote_from_line_items) writes these columns too, but
-- only ever fires off a line change, and lines cannot change outside draft — so
-- this guard can never fight it.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_quote_money_immutable_after_send()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'draft' then
    return new;
  end if;

  if new.subtotal       is distinct from old.subtotal
  or new.tax_amount     is distinct from old.tax_amount
  or new.total          is distinct from old.total
  or new.deposit_amount is distinct from old.deposit_amount
  or new.deposit_pct    is distinct from old.deposit_pct
  or new.tax_pct        is distinct from old.tax_pct
  or new.valid_until    is distinct from old.valid_until
  or new.token          is distinct from old.token
  then
    raise exception
      'Quote money and token are frozen once the quote leaves draft (current: %)', old.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_money_immutable_after_send on public.quotes;

create trigger quotes_money_immutable_after_send
before update on public.quotes
for each row
execute function public.enforce_quote_money_immutable_after_send();

comment on function public.enforce_quote_money_immutable_after_send() is
  'Blocks changes to subtotal/tax/total/deposit/validity/token on a non-draft quote (§7.1).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. `overridden` is derived, never asserted.
--
-- The Bubble call hardcodes "overridden": true on every save, so changing only
-- the quantity marked the price as drifted. A pill driven off that flag would be
-- lying. Compute it here instead: a line is overridden when it carries a price
-- that differs from its price-book item's current price. Lines with no
-- price_book_item_id are manual pricing, not overrides.
--
-- Whatever the client sends in this column is discarded — same shape as the AI
-- price guardrail (§13 R1): the write is re-derived server-side, always.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_quote_line_overridden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  book_price numeric;
begin
  if new.price_book_item_id is null or new.unit_price is null then
    new.overridden := false;
    return new;
  end if;

  select unit_price into book_price
  from public.price_book_items
  where id = new.price_book_item_id;

  -- Item deleted out from under the line: nothing to compare against.
  if book_price is null then
    new.overridden := false;
    return new;
  end if;

  new.overridden := (round(new.unit_price, 2) is distinct from round(book_price, 2));
  return new;
end;
$$;

drop trigger if exists quote_line_items_set_overridden on public.quote_line_items;

create trigger quote_line_items_set_overridden
before insert or update on public.quote_line_items
for each row
execute function public.set_quote_line_overridden();

comment on function public.set_quote_line_overridden() is
  'Derives quote_line_items.overridden from the live price book; ignores what the client sent (§6.2).';

-- Repair rows the hardcoded flag already mislabelled.
--
-- enforce_quote_line_items_draft_only() rejects any write to a line whose parent
-- has left draft, so a straight UPDATE here would abort the migration on the
-- first sent quote. Suspend that guard for the backfill only — this is a
-- one-time correction of a column the client never should have been setting.
alter table public.quote_line_items disable trigger quote_line_items_draft_only;

update public.quote_line_items l
set overridden = (
  l.price_book_item_id is not null
  and l.unit_price is not null
  and round(l.unit_price, 2) is distinct from round(p.unit_price, 2)
)
from public.price_book_items p
where p.id = l.price_book_item_id
  and l.overridden is distinct from (
    l.unit_price is not null
    and round(l.unit_price, 2) is distinct from round(p.unit_price, 2)
  );

update public.quote_line_items
set overridden = false
where price_book_item_id is null
  and overridden is distinct from false;

alter table public.quote_line_items enable trigger quote_line_items_draft_only;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. §8.1 double-booking warning.
--
-- "double-booking the same tech at overlapping times shows a warning
--  [ASSUMPTION: warning, not hard block, in v1]" — so this reports, it does not
-- reject. Bubble calls it on technician/date change and renders whatever comes
-- back as an amber line; Assign stays enabled.
--
-- SECURITY INVOKER on purpose: it runs under the caller's JWT, so RLS decides
-- what is visible. An admin sees the whole company; nobody else gets rows.
-- Overlap test is the standard half-open one: newStart < oldEnd AND oldStart < newEnd.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.check_technician_conflicts(
  p_technician_id uuid,
  p_scheduled_at  timestamptz,
  p_duration_min  integer default 60,
  p_exclude_job_id uuid default null
)
returns table (
  job_id        uuid,
  customer_name text,
  work_summary  text,
  scheduled_at  timestamptz,
  duration_min  integer,
  ends_at       timestamptz,
  status        text
)
language sql
stable
as $$
  select
    j.id,
    j.customer_name,
    j.work_summary,
    j.scheduled_at,
    j.duration_min,
    j.scheduled_at + make_interval(mins => coalesce(j.duration_min, 60)),
    j.status
  from public.jobs j
  where j.technician_id = p_technician_id
    and j.scheduled_at is not null
    and j.status in ('scheduled', 'en_route', 'in_progress')
    and (p_exclude_job_id is null or j.id <> p_exclude_job_id)
    -- overlap
    and p_scheduled_at < j.scheduled_at + make_interval(mins => coalesce(j.duration_min, 60))
    and j.scheduled_at < p_scheduled_at + make_interval(mins => coalesce(p_duration_min, 60))
  order by j.scheduled_at asc
  limit 10;
$$;

comment on function public.check_technician_conflicts(uuid, timestamptz, integer, uuid) is
  '§8.1 warning feed: jobs already booked for this technician overlapping the proposed slot. Reports only.';

revoke all on function public.check_technician_conflicts(uuid, timestamptz, integer, uuid) from public, anon;
grant execute on function public.check_technician_conflicts(uuid, timestamptz, integer, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. §7.1 "Quote page shows … company details".
--
-- company_settings only carried a name and a logo, so /q could say who the quote
-- was from but not how to reach them — for a customer being asked to hand over a
-- deposit, that is the missing half. resolve-quote-token now returns these.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.company_settings
  add column if not exists contact_email   text,
  add column if not exists contact_phone   text,
  add column if not exists contact_address text;

comment on column public.company_settings.contact_email is
  'Shown to customers on the tokenized quote page and in emails (§7.1).';

-- Seed from the first active admin so /q is never blank before Settings is filled in.
update public.company_settings cs
set contact_email = p.email
from public.profiles p
where p.company_id = cs.company_id
  and p.role = 'admin'
  and p.active = true
  and cs.contact_email is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. `assistant_actions.status` gains an in-flight value.
--
-- ops-confirm used to read status='proposed', do the work, then write the result.
-- Two Confirm clicks landing together both passed the read and both executed. It
-- now claims the row first (proposed → executing) and only the request that wins
-- that UPDATE proceeds, so the CHECK has to admit the intermediate state.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.assistant_actions
  drop constraint if exists assistant_actions_status_check;

alter table public.assistant_actions
  add constraint assistant_actions_status_check
  check (status in ('proposed', 'executing', 'executed', 'declined', 'failed'));

-- A crash between claim and result would strand a row in 'executing'. Nothing
-- retries automatically; the admin just asks again and confirms the new proposal.
comment on constraint assistant_actions_status_check on public.assistant_actions is
  'proposed → executing → executed|failed, or proposed → declined. executing is held only for the duration of one ops-confirm call.';
