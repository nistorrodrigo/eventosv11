-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Migration: ls_resend_keys                                       ║
-- ║  Date:      2026-05-12                                           ║
-- ║                                                                  ║
-- ║  Moves the per-user Resend API key out of the                    ║
-- ║  ls_events.roadshow.trip.resendKey JSON blob into a dedicated    ║
-- ║  secrets table with strict RLS, so the key is never leaked to    ║
-- ║  collaborators when an event is shared via ls_event_shares.      ║
-- ║                                                                  ║
-- ║  HOW TO APPLY                                                    ║
-- ║  1. Open https://supabase.com/dashboard → your project           ║
-- ║  2. SQL Editor → New Query                                       ║
-- ║  3. Paste this whole file, click Run                             ║
-- ║  4. Verify on Table Editor that ls_resend_keys exists and        ║
-- ║     "Row Level Security" is enabled (green padlock)              ║
-- ║                                                                  ║
-- ║  The client-side migration (silent copy from the JSON blob to    ║
-- ║  this table, then null out the old field) runs automatically the ║
-- ║  next time each user signs in after deploy.                      ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ── Table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ls_resend_keys (
  owner_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ls_resend_keys IS
  'Per-user Resend API keys for sending emails from the LS Event Manager. '
  'One row per Supabase auth user. Strict RLS — owner only.';

-- ── Row Level Security ────────────────────────────────────────────
ALTER TABLE public.ls_resend_keys ENABLE ROW LEVEL SECURITY;

-- Owner can SELECT only their own row
DROP POLICY IF EXISTS "owner can read own key" ON public.ls_resend_keys;
CREATE POLICY "owner can read own key" ON public.ls_resend_keys
  FOR SELECT
  USING (owner_id = auth.uid());

-- Owner can INSERT only with their own owner_id
DROP POLICY IF EXISTS "owner can insert own key" ON public.ls_resend_keys;
CREATE POLICY "owner can insert own key" ON public.ls_resend_keys
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Owner can UPDATE only their own row, and not transfer ownership
DROP POLICY IF EXISTS "owner can update own key" ON public.ls_resend_keys;
CREATE POLICY "owner can update own key" ON public.ls_resend_keys
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Owner can DELETE only their own row
DROP POLICY IF EXISTS "owner can delete own key" ON public.ls_resend_keys;
CREATE POLICY "owner can delete own key" ON public.ls_resend_keys
  FOR DELETE
  USING (owner_id = auth.uid());

-- ── updated_at trigger ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ls_resend_keys_touch ON public.ls_resend_keys;
CREATE TRIGGER ls_resend_keys_touch
  BEFORE UPDATE ON public.ls_resend_keys
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ── Done ──────────────────────────────────────────────────────────
-- Smoke test (run as the signed-in user — should return your row or 0 rows, never another user's):
--   SELECT * FROM public.ls_resend_keys;
