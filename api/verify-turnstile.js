// ── /api/verify-turnstile.js — Cloudflare Turnstile verification ──────────────
//
// Validates a Turnstile token issued by the client widget against Cloudflare's
// `siteverify` endpoint. The booking page (BookingPage.jsx) calls this BEFORE
// it submits a reservation to Supabase; only valid tokens get past the gate.
//
// Required Vercel environment variable:
//   TURNSTILE_SECRET_KEY   — Cloudflare-issued secret (NOT prefixed with VITE_)
//                            so it never ships to the client bundle.
//
// If the env var is not set, this endpoint returns 503 → BookingPage falls
// back to its existing client-side guards (honeypot + cooldown + min-fill).
//
// Auto-deployed by Vercel as a Serverless Function (no extra config needed).

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export default async function handler(req, res) {
  // Always JSON, always plain CORS (same-origin in practice — booking page lives
  // on the same Vercel domain — but be explicit for clarity)
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // Not configured — let the client know so it can fall back gracefully
    res.status(503).json({ ok: false, error: "turnstile_not_configured" });
    return;
  }

  let token;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    token = body.token;
  } catch {
    res.status(400).json({ ok: false, error: "invalid_body" });
    return;
  }
  if (!token || typeof token !== "string") {
    res.status(400).json({ ok: false, error: "missing_token" });
    return;
  }

  // Capture client IP for the verification request — improves Cloudflare's
  // signal but optional. Vercel sets `x-forwarded-for` and `x-real-ip`.
  const remoteip =
    (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    "";

  try {
    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", token);
    if (remoteip) form.append("remoteip", remoteip);

    const r = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = await r.json();

    if (data?.success) {
      res.status(200).json({ ok: true, hostname: data.hostname, challenge_ts: data.challenge_ts });
      return;
    }
    // Pass through CF's error codes so we can debug; don't reveal secret
    res.status(403).json({ ok: false, error: "turnstile_failed", codes: data?.["error-codes"] || [] });
  } catch (err) {
    res.status(502).json({ ok: false, error: "verify_request_failed", detail: String(err?.message || err) });
  }
}
