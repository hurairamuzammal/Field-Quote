-- When quote lines change, recalculate quote money totals in DB
-- (same math as draft-quote / send-quote). Bubble only refetches Get Quote.

create or replace function public.sync_quote_from_line_items(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subtotal numeric(12,2);
  v_tax_pct numeric(5,2);
  v_deposit_pct numeric(5,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
  v_deposit numeric(12,2);
  v_needs boolean;
begin
  select coalesce(sum(li.qty * li.unit_price), 0)
  into v_subtotal
  from public.quote_line_items li
  where li.quote_id = p_quote_id
    and li.unit_price is not null;

  v_subtotal := round(v_subtotal, 2);

  select q.tax_pct, q.deposit_pct
  into v_tax_pct, v_deposit_pct
  from public.quotes q
  where q.id = p_quote_id;

  if not found then
    return;
  end if;

  v_tax := round(v_subtotal * (coalesce(v_tax_pct, 0) / 100), 2);
  v_total := round(v_subtotal + v_tax, 2);
  v_deposit := round(v_total * (coalesce(v_deposit_pct, 0) / 100), 2);

  v_needs := exists (
    select 1
    from public.quote_line_items li
    where li.quote_id = p_quote_id
      and li.unit_price is null
  );

  update public.quotes q
  set
    subtotal = v_subtotal,
    tax_amount = v_tax,
    total = v_total,
    deposit_amount = v_deposit,
    needs_manual_pricing = v_needs
  where q.id = p_quote_id;
end;
$$;

-- Keep old name as alias so nothing breaks if still called.
create or replace function public.sync_quote_needs_manual_pricing(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_quote_from_line_items(p_quote_id);
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
  perform public.sync_quote_from_line_items(qid);
  return coalesce(new, old);
end;
$$;

-- Backfill money + flag for existing quotes from current lines.
do $$
declare
  r record;
begin
  for r in select id from public.quotes loop
    perform public.sync_quote_from_line_items(r.id);
  end loop;
end $$;
