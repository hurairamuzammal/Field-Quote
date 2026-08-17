-- Admin Payments table Realtime: webhook INSERT must reach Bubble (bump s_payments_ts).
-- Idempotent: skip if already in supabase_realtime.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'payments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
END $$;
