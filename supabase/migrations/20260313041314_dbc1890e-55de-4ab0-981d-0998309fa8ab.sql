-- Replay-safe normalization of the legacy extension bootstrap.
-- Supabase may provision pg_cron / pg_net before project migrations run.
-- Avoid re-running CREATE EXTENSION against an already provisioned extension,
-- which can fail because Supabase has already attached dependent privileges.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron WITH SCHEMA pg_catalog;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    CREATE EXTENSION pg_net WITH SCHEMA public;
  END IF;
END
$$;
