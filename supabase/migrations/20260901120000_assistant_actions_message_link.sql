-- Phase D (P1 Day 22 · P2 §5.6): the assistant proposes, the admin confirms.
--
-- `assistant_actions` already carries action_name / payload / status / executed_by,
-- but it links only to a session. The chat UI needs to anchor a Confirm card under
-- the exact assistant bubble that proposed it, so add the message link.
--
-- No status values change: proposed → executed | declined | failed is already the
-- CHECK constraint, and admin_all RLS already covers this table.

alter table public.assistant_actions
  add column if not exists message_id uuid
    references public.chat_messages(id) on delete cascade;

comment on column public.assistant_actions.message_id is
  'The assistant chat_messages row this proposal belongs under. Set after the '
  'reply is persisted, because the tool runs before the reply exists.';

-- The chat panel asks "what actions belong to this thread" on every open.
create index if not exists assistant_actions_session_created_idx
  on public.assistant_actions (session_id, created_at);

-- The confirm endpoint asks "is this one still proposed" on every click.
create index if not exists assistant_actions_status_idx
  on public.assistant_actions (status)
  where status = 'proposed';

create index if not exists assistant_actions_message_idx
  on public.assistant_actions (message_id)
  where message_id is not null;
