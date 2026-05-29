// ── cloudSync.test.js — Realtime-echo + Zod normaliser specs ──
//
// Pins down the behaviour that bit us during the audit. Both helpers are
// pure so the tests are short and self-contained.
import { describe, it, expect } from "vitest";
import { hashEventData, normalizeRoadshow } from "../utils/cloudSync.ts";

// ────────────────────────────────────────────────────────────────────
// hashEventData
// ────────────────────────────────────────────────────────────────────
describe("hashEventData", () => {
  it("is deterministic for the same input", () => {
    const data = { trip: { fund: "Templeton" }, meetings: [] };
    expect(hashEventData(data)).toBe(hashEventData(data));
  });

  it("returns a number, not a string", () => {
    expect(typeof hashEventData({})).toBe("number");
  });

  // The bug we fixed: the prior implementation hashed only the byte length,
  // so two different events that happened to serialise to the same length
  // collided and the realtime channel suppressed legitimate updates.
  it("returns a DIFFERENT hash for payloads with the same length but different content", () => {
    const a = { trip: { fund: "AAA" } };
    const b = { trip: { fund: "BBB" } }; // same serialised length
    const sa = JSON.stringify(a);
    const sb = JSON.stringify(b);
    expect(sa.length).toBe(sb.length); // sanity — same length
    expect(hashEventData(a)).not.toBe(hashEventData(b));
  });

  it("treats nested array order changes as different content", () => {
    expect(hashEventData({ meetings: [{ id: "m1" }, { id: "m2" }] }))
      .not.toBe(hashEventData({ meetings: [{ id: "m2" }, { id: "m1" }] }));
  });

  it("handles null / undefined / empty object without throwing", () => {
    expect(() => hashEventData(null)).not.toThrow();
    expect(() => hashEventData(undefined)).not.toThrow();
    expect(hashEventData(null)).toBe(hashEventData({})); // both serialise to "{}"
  });
});

// ────────────────────────────────────────────────────────────────────
// normalizeRoadshow
// ────────────────────────────────────────────────────────────────────
describe("normalizeRoadshow", () => {
  it("fills in defaults for fields added after the event was saved", () => {
    // Pre-multi-fund event: no `funds`, meetings missing `attendingFundIds`
    // and `travelMinutes`. Stored by an older client.
    const stored = {
      trip: { fund: "Templeton" },
      meetings: [
        { id: "m1", date: "2026-04-20", hour: 10, type: "company", companyId: "co1" },
      ],
      companies: [{ id: "co1", name: "YPF" }],
    };
    const out = normalizeRoadshow(stored);
    expect(out.trip.funds).toEqual([]);                  // new field default
    expect(out.meetings[0].attendingFundIds).toEqual([]); // new field default
    expect(out.meetings[0].travelMinutes).toBe(0);        // new field default
  });

  it("returns the input untouched when it can't be parsed (graceful degradation)", () => {
    // A wholly malformed blob shouldn't crash the loader — we want the user
    // to still see something they can fix from the UI.
    const malformed = { trip: "this is not an object", meetings: "nope" };
    const out = normalizeRoadshow(malformed);
    expect(out).toBe(malformed);
  });

  it("returns null/primitives untouched", () => {
    expect(normalizeRoadshow(null)).toBe(null);
    expect(normalizeRoadshow(undefined)).toBe(undefined);
    expect(normalizeRoadshow(42)).toBe(42);
    expect(normalizeRoadshow("string")).toBe("string");
  });

  it("preserves multi-fund data when present", () => {
    const stored = {
      trip: {
        fund: "Templeton",
        funds: [{ id: "blk", fund: "Blackrock", visitors: [{ name: "Larry Fink" }] }],
      },
      meetings: [{
        id: "m1", date: "2026-04-20", hour: 10, type: "company", companyId: "co1",
        attendingFundIds: ["blk"], travelMinutes: 15,
      }],
      companies: [{ id: "co1", name: "YPF" }],
    };
    const out = normalizeRoadshow(stored);
    expect(out.trip.funds).toHaveLength(1);
    expect(out.trip.funds[0].fund).toBe("Blackrock");
    expect(out.meetings[0].attendingFundIds).toEqual(["blk"]);
    expect(out.meetings[0].travelMinutes).toBe(15);
  });
});
