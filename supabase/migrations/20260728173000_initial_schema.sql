-- FieldQuote §12 / Week 1 Day 1: complete initial schema.
-- All application data lives in Supabase; files are referenced by R2 object keys only.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null,
  role text not null check (role in ('admin', 'technician')),
  full_name text not null,
  email text not null unique,
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.company_settings (
  company_id uuid primary key,
  name text not null,
  logo_key text,
  deposit_pct numeric(5,2) not null default 30 check (deposit_pct >= 0 and deposit_pct <= 100),
  tax_pct numeric(5,2) not null default 20 check (tax_pct >= 0 and tax_pct <= 100),
  quote_validity_days integer not null default 14 check (quote_validity_days > 0),
  labor_rate numeric(12,2) not null default 65 check (labor_rate >= 0),
  working_hours jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.price_book_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  name text not null,
  category text not null,
  unit text not null check (unit in ('job', 'hour', 'unit')),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  keywords text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, name)
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  description text not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  customer_address text not null,
  preferred_timing text,
  status text not null default 'new' check (status in ('new', 'quoted', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.request_media (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  request_id uuid not null references public.requests(id) on delete cascade,
  r2_key text not null,
  kind text not null check (kind in ('photo', 'audio')),
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  request_id uuid not null references public.requests(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  token text unique,
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  deposit_pct numeric(5,2) not null default 0 check (deposit_pct >= 0 and deposit_pct <= 100),
  tax_pct numeric(5,2) not null default 0 check (tax_pct >= 0 and tax_pct <= 100),
  ai_generated boolean not null default false,
  ai_model text,
  ai_raw jsonb,
  internal_notes text,
  valid_until timestamptz,
  viewed_at timestamptz,
  declined_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  price_book_item_id uuid references public.price_book_items(id) on delete set null,
  label text not null,
  qty numeric(12,2) not null default 1 check (qty > 0),
  unit_price numeric(12,2) check (unit_price is null or unit_price >= 0),
  overridden boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  quote_id uuid not null unique references public.quotes(id) on delete restrict,
  status text not null default 'unscheduled' check (status in ('unscheduled', 'scheduled', 'en_route', 'in_progress', 'completed', 'cancelled')),
  technician_id uuid references public.profiles(id) on delete set null,
  scheduled_at timestamptz,
  duration_min integer check (duration_min is null or duration_min > 0),
  completion_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.job_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  from_status text,
  to_status text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.job_media (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  r2_key text not null,
  kind text not null check (kind = 'completion_photo'),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  quote_id uuid not null references public.quotes(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete restrict,
  kind text not null check (kind in ('deposit', 'final')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'gbp' check (char_length(currency) = 3),
  stripe_session_id text not null unique,
  stripe_event_id text not null unique,
  status text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  to_email text not null,
  template text not null,
  related_id uuid,
  resend_id text unique,
  status text not null,
  sent_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  token_count integer not null default 0 check (token_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.assistant_actions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  session_id uuid references public.chat_sessions(id) on delete set null,
  action_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null check (status in ('proposed', 'executed', 'declined', 'failed')),
  executed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  executed_at timestamptz
);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  email text not null,
  source text not null default 'landing',
  created_at timestamptz not null default timezone('utc', now()),
  unique (company_id, email)
);

create index price_book_items_company_active_idx on public.price_book_items(company_id, active);
create index requests_company_status_created_idx on public.requests(company_id, status, created_at desc);
create index request_media_request_idx on public.request_media(request_id);
create index quotes_company_status_created_idx on public.quotes(company_id, status, created_at desc);
create index quotes_token_idx on public.quotes(token) where token is not null;
create index quote_line_items_quote_idx on public.quote_line_items(quote_id);
create index jobs_technician_status_scheduled_idx on public.jobs(technician_id, status, scheduled_at);
create index job_events_job_created_idx on public.job_events(job_id, created_at);
create index job_media_job_idx on public.job_media(job_id);
create index payments_quote_idx on public.payments(quote_id);
create index email_log_related_template_idx on public.email_log(related_id, template, sent_at);
create index chat_messages_session_created_idx on public.chat_messages(session_id, created_at);
create index waitlist_created_idx on public.waitlist(created_at desc);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger company_settings_set_updated_at before update on public.company_settings for each row execute function public.set_updated_at();
create trigger price_book_items_set_updated_at before update on public.price_book_items for each row execute function public.set_updated_at();
create trigger requests_set_updated_at before update on public.requests for each row execute function public.set_updated_at();
create trigger quotes_set_updated_at before update on public.quotes for each row execute function public.set_updated_at();
create trigger quote_line_items_set_updated_at before update on public.quote_line_items for each row execute function public.set_updated_at();
create trigger jobs_set_updated_at before update on public.jobs for each row execute function public.set_updated_at();
create trigger chat_sessions_set_updated_at before update on public.chat_sessions for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.price_book_items enable row level security;
alter table public.requests enable row level security;
alter table public.request_media enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;
alter table public.jobs enable row level security;
alter table public.job_events enable row level security;
alter table public.job_media enable row level security;
alter table public.payments enable row level security;
alter table public.email_log enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.assistant_actions enable row level security;
alter table public.waitlist enable row level security;
