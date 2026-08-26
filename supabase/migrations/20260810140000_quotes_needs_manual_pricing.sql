-- Persist needs_manual_pricing on quotes; keep in sync when line prices change.

alter table public.quotes
  add column if not exists needs_manual_pricing boolean not null default false;

comment on column public.quotes.needs_manual_pricing is
  'True when any quote_line_items row for this quote has unit_price IS NULL.';

-- Backfill existing quotes from line items.
update public.quotes q
set needs_manual_pricing = exists (
  select 1
  from public.quote_line_items li
  where li.quote_id = q.id
    and li.unit_price is null
);

create or replace function public.sync_quote_needs_manual_pricing(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.quotes q
  set needs_manual_pricing = exists (
    select 1
    from public.quote_line_items li
    where li.quote_id = p_quote_id
      and li.unit_price is null
  )
  where q.id = p_quote_id;
end;
$$;

create or replace function public.trg_quote_line_items_sync_needs_manual_pricing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  qid uuid;
begin
  qid := coalesce(new.quote_id, old.quote_id);
  perform public.sync_quote_needs_manual_pricing(qid);
  return coalesce(new, old);
end;
$$;

drop trigger if exists quote_line_items_sync_needs_manual_pricing on public.quote_line_items;

create trigger quote_line_items_sync_needs_manual_pricing
after insert or update of unit_price, qty or delete
on public.quote_line_items
for each row
execute function public.trg_quote_line_items_sync_needs_manual_pricing();
