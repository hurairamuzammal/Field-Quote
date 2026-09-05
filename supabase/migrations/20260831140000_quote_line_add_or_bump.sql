-- Adding a price-book item that is already on a quote should raise its quantity,
-- not create a second row. Doing this in the client races on a double-click and
-- would have to be repeated in draft-quote; one RPC keeps it in a single place.
--
-- 1) merge any duplicates that already exist
-- 2) partial unique index on (quote_id, price_book_item_id) — one-off lines keep
--    price_book_item_id null and are unaffected, because NULLs are distinct
-- 3) add_quote_line() — insert, or bump qty on conflict

-- ---------------------------------------------------------------- 1. backfill
-- enforce_quote_line_items_draft_only blocks update/delete on non-draft quotes,
-- so it has to stand down for the merge. Re-enabled at the end of this block.
alter table public.quote_line_items disable trigger quote_line_items_draft_only;

-- sum the quantities onto the oldest row of each duplicate set
update public.quote_line_items k
set qty = agg.total_qty
from (
  select
    (array_agg(id order by created_at, id))[1] as keep_id,
    sum(qty)                                   as total_qty,
    count(*)                                   as n
  from public.quote_line_items
  where price_book_item_id is not null
  group by quote_id, price_book_item_id
) agg
where k.id = agg.keep_id
  and agg.n > 1;

-- then drop the extras
delete from public.quote_line_items x
using (
  select
    quote_id,
    price_book_item_id,
    (array_agg(id order by created_at, id))[1] as keep_id
  from public.quote_line_items
  where price_book_item_id is not null
  group by quote_id, price_book_item_id
  having count(*) > 1
) agg
where x.quote_id = agg.quote_id
  and x.price_book_item_id = agg.price_book_item_id
  and x.id <> agg.keep_id;

alter table public.quote_line_items enable trigger quote_line_items_draft_only;

-- ---------------------------------------------------------------- 2. the index
-- Partial, so multiple one-off lines (price_book_item_id null) stay legal.
create unique index if not exists quote_line_items_quote_pbi_key
  on public.quote_line_items (quote_id, price_book_item_id)
  where price_book_item_id is not null;

comment on index public.quote_line_items_quote_pbi_key is
  'One row per price-book item per quote. One-off lines (null item) are exempt.';

-- ---------------------------------------------------------------- 3. the RPC
create or replace function public.add_quote_line(
  p_quote_id           uuid,
  p_price_book_item_id uuid,
  p_qty                numeric default 1
)
returns public.quote_line_items
language plpgsql
security invoker              -- RLS still applies: admin_all only
set search_path = public
as $$
declare
  v_company uuid;
  v_label   text;
  v_price   numeric(12,2);
  v_row     public.quote_line_items;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero'
      using errcode = 'check_violation';
  end if;

  -- company comes from the quote, never from the client
  select q.company_id into v_company
  from public.quotes q
  where q.id = p_quote_id;

  if v_company is null then
    raise exception 'Quote % not found', p_quote_id
      using errcode = 'no_data_found';
  end if;

  -- label and price come from the price book, never from the client
  select pbi.name, pbi.unit_price into v_label, v_price
  from public.price_book_items pbi
  where pbi.id = p_price_book_item_id
    and pbi.company_id = v_company;

  if v_label is null then
    raise exception 'Price book item not found for this company'
      using errcode = 'foreign_key_violation';
  end if;

  insert into public.quote_line_items
    (company_id, quote_id, price_book_item_id, label, qty, unit_price)
  values
    (v_company, p_quote_id, p_price_book_item_id, v_label, p_qty, v_price)
  on conflict (quote_id, price_book_item_id) where price_book_item_id is not null
  do update
     set qty = quote_line_items.qty + excluded.qty
     -- unit_price is deliberately untouched: an overridden price survives a re-add
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.add_quote_line(uuid, uuid, numeric) is
  'Adds a price-book item to a draft quote, or raises qty if it is already there. '
  'Label, price and company are read server-side. Quote totals recalculate via the '
  'existing after-insert/update trigger. Blocked on non-draft quotes by '
  'enforce_quote_line_items_draft_only.';

grant execute on function public.add_quote_line(uuid, uuid, numeric) to authenticated;
