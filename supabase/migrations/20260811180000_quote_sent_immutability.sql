-- Lock quote documents after send: no line edits; enforce status transitions.
-- Bubble UI gates are UX only — this is the real boundary (admin JWT + PostgREST).

-- 1) Quote status machine: draft → sent → viewed → accepted|declined|expired
--    Also allow sent → expired|accepted|declined (cron / pay without view).
create or replace function public.enforce_quote_status_transition()
returns trigger
language plpgsql
as $$
declare
  allowed boolean := false;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.status = 'draft' and new.status = 'sent' then
    allowed := true;
  elsif old.status = 'sent' and new.status in ('viewed', 'expired', 'accepted', 'declined') then
    allowed := true;
  elsif old.status = 'viewed' and new.status in ('accepted', 'declined', 'expired') then
    allowed := true;
  end if;

  if not allowed then
    raise exception 'Illegal quote status transition: % → %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists quotes_enforce_status_transition on public.quotes;

create trigger quotes_enforce_status_transition
before update of status on public.quotes
for each row
execute function public.enforce_quote_status_transition();

comment on function public.enforce_quote_status_transition() is
  'Enforces quotes.status flow draft→sent→viewed→accepted|declined|expired (plus sent shortcuts).';

-- 2) Line items mutable only while parent quote is draft (blocks PostgREST PATCH after send).
create or replace function public.enforce_quote_line_items_draft_only()
returns trigger
language plpgsql
as $$
declare
  qid uuid;
  qstatus text;
begin
  qid := coalesce(new.quote_id, old.quote_id);
  select status into qstatus from public.quotes where id = qid;

  -- Parent already gone (cascade edge): allow the child delete to finish.
  if qstatus is null and tg_op = 'DELETE' then
    return old;
  end if;

  if qstatus is null then
    raise exception 'Quote % not found for line item change', qid
      using errcode = 'foreign_key_violation';
  end if;

  if qstatus <> 'draft' then
    raise exception 'Quote line items can only be changed while status is draft (current: %)', qstatus
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists quote_line_items_draft_only on public.quote_line_items;

create trigger quote_line_items_draft_only
before insert or update or delete on public.quote_line_items
for each row
execute function public.enforce_quote_line_items_draft_only();

comment on function public.enforce_quote_line_items_draft_only() is
  'Rejects insert/update/delete on quote_line_items unless parent quotes.status = draft.';
