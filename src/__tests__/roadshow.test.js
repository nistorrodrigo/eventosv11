// ── roadshow.test.js — Multi-fund helpers + rsToEntity ──
import { describe, it, expect } from "vitest";
import {
  PRIMARY_FUND_ID,
  getAllFunds,
  isMultiFund,
  fundLabel,
  meetingsForFund,
  rsToEntity,
} from "../roadshow.jsx";

// ────────────────────────────────────────────────────────────────────
// Multi-fund helpers
// ────────────────────────────────────────────────────────────────────
describe("getAllFunds", () => {
  it("returns a single primary entry when trip has no extra funds", () => {
    const trip = { fund: "Templeton", clientName: "Frank Templeton", visitors: [] };
    const funds = getAllFunds(trip);
    expect(funds).toHaveLength(1);
    expect(funds[0].id).toBe(PRIMARY_FUND_ID);
    expect(funds[0].fund).toBe("Templeton");
  });

  it("includes additional funds after the primary", () => {
    const trip = {
      fund: "Templeton",
      visitors: [],
      funds: [{ id: "blk", fund: "Blackrock", visitors: [] }],
    };
    const funds = getAllFunds(trip);
    expect(funds).toHaveLength(2);
    expect(funds[0].id).toBe(PRIMARY_FUND_ID);
    expect(funds[1].id).toBe("blk");
  });

  it("returns a blank primary when trip is null/empty", () => {
    expect(getAllFunds(null)[0].id).toBe(PRIMARY_FUND_ID);
    expect(getAllFunds({}).length).toBe(1);
  });
});

describe("isMultiFund", () => {
  it("is false when only the primary fund exists", () => {
    expect(isMultiFund({ fund: "X" })).toBe(false);
    expect(isMultiFund({ fund: "X", funds: [] })).toBe(false);
  });
  it("is true once any extra fund is added", () => {
    expect(isMultiFund({ fund: "X", funds: [{ id: "blk" }] })).toBe(true);
  });
});

describe("fundLabel", () => {
  it("prefers `fund`, then `clientName`, then a fallback", () => {
    expect(fundLabel({ fund: "Templeton" })).toBe("Templeton");
    expect(fundLabel({ clientName: "Frank" })).toBe("Frank");
    expect(fundLabel({})).toBe("Fondo sin nombre");
  });
});

// ────────────────────────────────────────────────────────────────────
// meetingsForFund
// ────────────────────────────────────────────────────────────────────
describe("meetingsForFund", () => {
  const common  = { id: "m1", attendingFundIds: [] };
  const tplOnly = { id: "m2", attendingFundIds: [PRIMARY_FUND_ID] };
  const blkOnly = { id: "m3", attendingFundIds: ["blk"] };
  const orphan  = { id: "m4", attendingFundIds: ["DELETED_FUND"] };

  it("returns everything when fundId is null (combined view)", () => {
    expect(meetingsForFund([common, tplOnly, blkOnly], null)).toHaveLength(3);
  });

  it("returns common + the fund's own meetings for a specific fund", () => {
    const out = meetingsForFund([common, tplOnly, blkOnly], "blk");
    expect(out.map(m => m.id)).toEqual(["m1", "m3"]);
  });

  it("treats meetings whose attendingFundIds all reference deleted funds as common", () => {
    // Without the roster, the orphan would silently disappear from every per-fund view.
    const roster = [PRIMARY_FUND_ID, "blk"]; // DELETED_FUND no longer in roster
    const out = meetingsForFund([common, orphan, blkOnly], "blk", roster);
    expect(out.map(m => m.id)).toEqual(["m1", "m4", "m3"]);
  });

  it("still hides a meeting whose attendingFundIds reference a live, non-matching fund", () => {
    const roster = [PRIMARY_FUND_ID, "blk", "tpl"];
    const out = meetingsForFund(
      [common, { id: "m5", attendingFundIds: ["tpl"] }],
      "blk",
      roster,
    );
    expect(out.map(m => m.id)).toEqual(["m1"]);
  });
});

// ────────────────────────────────────────────────────────────────────
// rsToEntity — PDF entity builder
// ────────────────────────────────────────────────────────────────────
describe("rsToEntity", () => {
  const baseTrip = {
    fund: "Templeton",
    clientName: "Frank Templeton",
    visitors: [{ name: "Mark Mobius", title: "PM" }],
    arrivalDate: "2026-04-20",
    departureDate: "2026-04-22",
  };
  const cos = [{ id: "co1", name: "YPF", ticker: "YPFD" }];
  const mkMtg = (over = {}) => ({
    id: "m" + Math.random(),
    date: "2026-04-20",
    hour: 10,
    type: "company",
    companyId: "co1",
    status: "confirmed",
    location: "ls_office",
    attendingFundIds: [],
    travelMinutes: 0,
    ...over,
  });

  it("returns null when there are no meetings", () => {
    expect(rsToEntity({ trip: baseTrip, meetings: [] }, cos)).toBeNull();
  });

  it("builds a single-day section with the meeting in it", () => {
    const e = rsToEntity(
      { trip: baseTrip, meetings: [mkMtg()] },
      cos,
    );
    expect(e.sections).toHaveLength(1);
    expect(e.sections[0].rows.some(r => !r.travelRow && /YPF/.test(r.col1))).toBe(true);
  });

  it("inserts a travel row before a non-first meeting when travelMinutes > 0", () => {
    const e = rsToEntity(
      {
        trip: baseTrip,
        meetings: [
          mkMtg({ hour: 10, location: "ls_office" }),
          mkMtg({ hour: 11, location: "hq",       travelMinutes: 20 }),
        ],
      },
      cos,
    );
    const rows = e.sections[0].rows;
    const travelIdx = rows.findIndex(r => r.travelRow);
    expect(travelIdx).toBeGreaterThan(0); // not first row of the day
    expect(rows[travelIdx].travelText).toMatch(/Travel from .* to .*approx\. 20 min/);
  });

  it("does NOT insert a travel row for the first meeting of the day", () => {
    const e = rsToEntity(
      { trip: baseTrip, meetings: [mkMtg({ travelMinutes: 99 })] },
      cos,
    );
    expect(e.sections[0].rows.some(r => r.travelRow)).toBe(false);
  });

  it("filters meetings to the chosen fund (common + that fund's specific)", () => {
    const trip = { ...baseTrip, funds: [{ id: "blk", fund: "Blackrock", visitors: [] }] };
    const meetings = [
      mkMtg({ hour: 9,  attendingFundIds: [] }),                  // common
      mkMtg({ hour: 10, attendingFundIds: [PRIMARY_FUND_ID] }),   // Templeton only
      mkMtg({ hour: 11, attendingFundIds: ["blk"] }),             // Blackrock only
    ];
    const e = rsToEntity({ trip, meetings }, cos, { fundId: "blk" });
    // 2 meeting rows + 1 travel row are unlikely here (travelMinutes is 0)
    const meetingRows = e.sections[0].rows.filter(r => !r.travelRow);
    expect(meetingRows).toHaveLength(2); // common + blk only
  });

  it("surfaces orphan meetings (only-deleted attendingFundIds) in per-fund view as common", () => {
    const trip = { ...baseTrip, funds: [{ id: "blk", fund: "Blackrock", visitors: [] }] };
    const meetings = [
      mkMtg({ hour: 9,  attendingFundIds: ["ghost_fund"] }), // orphan
      mkMtg({ hour: 10, attendingFundIds: ["blk"] }),
    ];
    const e = rsToEntity({ trip, meetings }, cos, { fundId: "blk" });
    const meetingRows = e.sections[0].rows.filter(r => !r.travelRow);
    expect(meetingRows).toHaveLength(2);
  });

  it("uses the selected fund's visitors on the cover when filtering per fund", () => {
    const trip = {
      ...baseTrip,
      funds: [{
        id: "blk",
        fund: "Blackrock",
        clientName: "Larry Fink",
        visitors: [{ name: "Larry Fink", title: "CEO" }],
      }],
    };
    const e = rsToEntity({ trip, meetings: [mkMtg()] }, cos, { fundId: "blk" });
    expect(e.coverTitle).toBe("Blackrock");
    expect(e.coverNames.map(n => n.name)).toEqual(["Larry Fink"]);
  });
});
