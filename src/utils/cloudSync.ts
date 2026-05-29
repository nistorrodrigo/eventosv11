// ── cloudSync.ts — Pure helpers for the cross-device sync layer ─────
//
// These used to live inline in App.jsx, where they were impossible to test
// in isolation. They're pure (input → output, no React, no Supabase) so
// pulling them out lets us pin down the behaviour with unit tests — the
// realtime echo collision bug (length-based hash) we fixed in the audit
// would have been caught immediately with even one of these tests in place.
//
// Anything that depends on React state, the Supabase client, or DOM goes
// in a hook or in App.jsx itself; this file stays pure.

import { RoadshowSchema } from "../schemas";

// ────────────────────────────────────────────────────────────────────
// hashEventData — content fingerprint of an event's `data` blob.
// ────────────────────────────────────────────────────────────────────
//
// Used by App.jsx's realtime-echo suppression: when WE save an event, we
// stamp its hash; when the realtime channel hands us the same row back,
// we skip applying it. The previous version compared just JSON.stringify
// length, which collided across different events whose payloads happened
// to be the same byte-length and let echoes from one event silently
// overwrite local edits to another.
//
// DJB2-style 32-bit accumulator. Collisions are not security-critical:
// a worst-case false-positive only delays one realtime update by the
// next save round-trip — it cannot leak data across users.
export function hashEventData(data: unknown): number {
  const s = JSON.stringify(data ?? {});
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h;
}

// ────────────────────────────────────────────────────────────────────
// normalizeRoadshow — run a stored roadshow blob through Zod so older
// events (saved before fields like funds[], attendingFundIds[],
// travelMinutes existed) get the defaults filled in. Returns the
// input untouched if the parse fails — a malformed event should still
// load so the user can fix it from the UI.
// ────────────────────────────────────────────────────────────────────
export function normalizeRoadshow<T>(rs: T): T {
  if (!rs || typeof rs !== "object") return rs;
  const r = RoadshowSchema.safeParse(rs);
  return r.success ? (r.data as unknown as T) : rs;
}
