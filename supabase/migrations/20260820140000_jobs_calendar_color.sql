-- Hex color for Bubble Full Calendar per-event coloring.
-- Docs: Event color field must be a HEX string, not status text.
-- https://manual.bubble.io/core-resources/bubble-made-plugins/full-calendar
--
-- There is no jobs.status = 'missed' in FieldQuote. Colors follow real statuses only.
-- "Missed" would be a future display rule (past scheduled_at while still open) — out of scope.

alter table public.jobs drop column if exists calendar_color;

alter table public.jobs
  add column calendar_color text
  generated always as (
    case status
      when 'scheduled' then '#eab308'      -- yellow
      when 'completed' then '#00b8a1'      -- FieldQuote accent (teal)
      when 'en_route' then '#d97706'       -- amber
      when 'in_progress' then '#4338ca'    -- indigo
      when 'cancelled' then '#94a3b8'      -- gray
      else '#64748b'                       -- unscheduled / other
    end
  ) stored;

comment on column public.jobs.calendar_color is
  'Display-only HEX for Bubble Full Calendar; derived from status (no missed status).';
