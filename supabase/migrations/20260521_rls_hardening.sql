-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Migration: RLS hardening for all main tables                    ║
-- ║  Date:      2026-05-21                                           ║
-- ║                                                                  ║
-- ║  Until now the RLS policies for ls_events, ls_event_shares,      ║
-- ║  ls_global_db, roadshow_slots and roadshow_bookings lived only   ║
-- ║  in the Supabase dashboard — not in this repo. This migration    ║
-- ║  brings them into source control as idempotent, re-runnable SQL  ║
-- ║  so they can be reviewed, audited and re-applied if dashboard    ║
-- ║  state drifts.                                                   ║
-- ║                                                                  ║
-- ║  COLUMN NAMING                                                   ║
-- ║  --------------                                                  ║
-- ║  ls_event_shares has TWO id columns: `invited_user_id` (the user ║
-- ║  the owner originally invited by email) and `shared_with_id`     ║
-- ║  (the user who actually accepted / signed in). Both can match    ║
-- ║  auth.uid() depending on flow. The email column is               ║
-- ║  `invited_email` (NOT shared_with_email — the client code has    ║
-- ║  been using the wrong name and the email-based share lookups     ║
-- ║  have been silently broken).                                     ║
-- ║                                                                  ║
-- ║  KEY SECURITY FIX                                                ║
-- ║  --------------------                                            ║
-- ║  The public booking page (anonymous users) inserts rows into     ║
-- ║  `roadshow_bookings` and used to supply `owner_id` from the      ║
-- ║  client. A malicious caller could forge that to point at any     ║
-- ║  user's queue. The trigger `booking_owner_from_slot` below       ║
-- ║  OVERRIDES whatever the client sends with the value from the     ║
-- ║  matching slot row — the slot table is the single source of      ║
-- ║  truth for ownership.                                            ║
-- ║                                                                  ║
-- ║  HOW TO APPLY                                                    ║
-- ║  1. supabase.com/dashboard → SQL Editor → New Query              ║
-- ║  2. Paste this whole file, click Run                             ║
-- ║  3. Verify policies on Table Editor (green padlocks on every     ║
-- ║     table listed below)                                          ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ════════════════════════════════════════════════════════════════════
-- ls_events
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.ls_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads own events"      ON public.ls_events;
DROP POLICY IF EXISTS "shared reads"                ON public.ls_events;
DROP POLICY IF EXISTS "owner writes own events"     ON public.ls_events;
DROP POLICY IF EXISTS "owner updates own events"    ON public.ls_events;
DROP POLICY IF EXISTS "owner deletes own events"    ON public.ls_events;
DROP POLICY IF EXISTS "editor writes shared events" ON public.ls_events;

CREATE POLICY "owner reads own events" ON public.ls_events
  FOR SELECT USING (user_id = auth.uid());

-- A user can read an event when they appear on a share row for it,
-- either as the resolved `shared_with_id`, the originally-invited
-- `invited_user_id`, or by their JWT email matching `invited_email`.
CREATE POLICY "shared reads" ON public.ls_events
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.ls_event_shares s
     WHERE s.event_id = ls_events.id
       AND (
            s.shared_with_id  = auth.uid()
         OR s.invited_user_id = auth.uid()
         OR lower(s.invited_email) = lower((auth.jwt() ->> 'email'))
       )
  ));

CREATE POLICY "owner writes own events" ON public.ls_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "owner updates own events" ON public.ls_events
  FOR UPDATE USING (user_id = auth.uid())
             WITH CHECK (user_id = auth.uid());

CREATE POLICY "editor writes shared events" ON public.ls_events
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.ls_event_shares s
     WHERE s.event_id = ls_events.id
       AND s.role = 'editor'
       AND (
            s.shared_with_id  = auth.uid()
         OR s.invited_user_id = auth.uid()
         OR lower(s.invited_email) = lower((auth.jwt() ->> 'email'))
       )
  ));

CREATE POLICY "owner deletes own events" ON public.ls_events
  FOR DELETE USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════
-- ls_event_shares
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.ls_event_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner manages shares"        ON public.ls_event_shares;
DROP POLICY IF EXISTS "invited user reads own share" ON public.ls_event_shares;
DROP POLICY IF EXISTS "owner inserts shares"        ON public.ls_event_shares;
DROP POLICY IF EXISTS "owner updates shares"        ON public.ls_event_shares;
DROP POLICY IF EXISTS "owner deletes shares"        ON public.ls_event_shares;

CREATE POLICY "owner manages shares" ON public.ls_event_shares
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "invited user reads own share" ON public.ls_event_shares
  FOR SELECT USING (
       shared_with_id  = auth.uid()
    OR invited_user_id = auth.uid()
    OR lower(invited_email) = lower((auth.jwt() ->> 'email'))
  );

-- Owner creates shares only for events they own.
CREATE POLICY "owner inserts shares" ON public.ls_event_shares
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.ls_events e
                 WHERE e.id = event_id AND e.user_id = auth.uid())
  );

-- Owner can edit share rows; the invited user can ALSO update
-- their own row to set `shared_with_id` to themselves on first
-- sign-in (the client does this in loadFromCloud after we resolve
-- their auth.uid()).
CREATE POLICY "owner updates shares" ON public.ls_event_shares
  FOR UPDATE USING (
       owner_id = auth.uid()
    OR lower(invited_email) = lower((auth.jwt() ->> 'email'))
  )
  WITH CHECK (
       owner_id = auth.uid()
    OR lower(invited_email) = lower((auth.jwt() ->> 'email'))
  );

CREATE POLICY "owner deletes shares" ON public.ls_event_shares
  FOR DELETE USING (owner_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════
-- ls_global_db
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.ls_global_db ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads own db"   ON public.ls_global_db;
DROP POLICY IF EXISTS "owner writes own db"  ON public.ls_global_db;
DROP POLICY IF EXISTS "owner updates own db" ON public.ls_global_db;
DROP POLICY IF EXISTS "owner deletes own db" ON public.ls_global_db;

CREATE POLICY "owner reads own db"   ON public.ls_global_db
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "owner writes own db"  ON public.ls_global_db
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner updates own db" ON public.ls_global_db
  FOR UPDATE USING (user_id = auth.uid())
             WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner deletes own db" ON public.ls_global_db
  FOR DELETE USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════
-- roadshow_slots
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.roadshow_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads slots"         ON public.roadshow_slots;
DROP POLICY IF EXISTS "owner manages slots insert" ON public.roadshow_slots;
DROP POLICY IF EXISTS "owner manages slots update" ON public.roadshow_slots;
DROP POLICY IF EXISTS "owner manages slots delete" ON public.roadshow_slots;
DROP POLICY IF EXISTS "anon claims one slot"       ON public.roadshow_slots;

CREATE POLICY "anyone reads slots" ON public.roadshow_slots
  FOR SELECT USING (true);

CREATE POLICY "owner manages slots insert" ON public.roadshow_slots
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner manages slots update" ON public.roadshow_slots
  FOR UPDATE USING (owner_id = auth.uid())
             WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner manages slots delete" ON public.roadshow_slots
  FOR DELETE USING (owner_id = auth.uid());

-- Anonymous booking page deletes ONE matching slot to claim it.
CREATE POLICY "anon claims one slot" ON public.roadshow_slots
  FOR DELETE USING (auth.role() = 'anon');

-- ════════════════════════════════════════════════════════════════════
-- roadshow_bookings
-- ════════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS public.roadshow_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner reads bookings"   ON public.roadshow_bookings;
DROP POLICY IF EXISTS "owner updates bookings" ON public.roadshow_bookings;
DROP POLICY IF EXISTS "owner deletes bookings" ON public.roadshow_bookings;
DROP POLICY IF EXISTS "anon inserts bookings"  ON public.roadshow_bookings;

CREATE POLICY "owner reads bookings" ON public.roadshow_bookings
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "owner updates bookings" ON public.roadshow_bookings
  FOR UPDATE USING (owner_id = auth.uid())
             WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owner deletes bookings" ON public.roadshow_bookings
  FOR DELETE USING (owner_id = auth.uid());

-- Anonymous visitors can insert; trigger below sets owner_id.
CREATE POLICY "anon inserts bookings" ON public.roadshow_bookings
  FOR INSERT WITH CHECK (auth.role() = 'anon');

-- ════════════════════════════════════════════════════════════════════
-- TRIGGER: derive owner_id from the matching slot, ignoring whatever
-- the client sends. Defence-in-depth — even with a tampered booking
-- page, the attacker can't write a booking pointing at someone else.
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.booking_owner_from_slot()
RETURNS TRIGGER AS $$
DECLARE
  derived UUID;
BEGIN
  SELECT s.owner_id INTO derived
    FROM public.roadshow_slots s
   WHERE s.event_id  = NEW.event_id
     AND s.slot_date = NEW.slot_date
     AND s.slot_hour = NEW.slot_hour
   LIMIT 1;

  -- Fallback to the event owner if the slot row was already deleted
  -- in the same transaction (the booking-page flow deletes-then-inserts).
  IF derived IS NULL THEN
    SELECT e.user_id INTO derived
      FROM public.ls_events e
     WHERE e.id = NEW.event_id
     LIMIT 1;
  END IF;

  IF derived IS NULL THEN
    RAISE EXCEPTION 'No matching slot/event found for booking — refusing insert';
  END IF;

  NEW.owner_id := derived;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS roadshow_bookings_owner_from_slot ON public.roadshow_bookings;
CREATE TRIGGER roadshow_bookings_owner_from_slot
  BEFORE INSERT ON public.roadshow_bookings
  FOR EACH ROW EXECUTE FUNCTION public.booking_owner_from_slot();

-- ════════════════════════════════════════════════════════════════════
-- Smoke tests (run as the signed-in owner)
-- ════════════════════════════════════════════════════════════════════
-- SELECT count(*) FROM public.ls_events;          -- only your events
-- SELECT count(*) FROM public.ls_global_db;       -- 0 or 1 (yours)
-- SELECT count(*) FROM public.roadshow_bookings;  -- only your bookings
