-- Item 9: never store invite/recovery hashed tokens on email_log.
-- Canonical copy lives in auth.users (GoTrue). Extra copies let admins finish someone else's link.
alter table public.email_log
  drop column if exists token_hash;
