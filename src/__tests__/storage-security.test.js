// ── storage-security.test.js — XSS / URL allowlist / PDF builder ──
import { describe, it, expect } from "vitest";
import { esc, safeUrl, buildPrintHTML } from "../storage.jsx";
import { rsToEntity, buildBookingPage } from "../roadshow.jsx";

// ────────────────────────────────────────────────────────────────────
// esc() — strict HTML escape (covers attribute positions too)
// ────────────────────────────────────────────────────────────────────
describe("esc", () => {
  it("escapes all 5 HTML-significant characters", () => {
    expect(esc(`<script>alert("x'y")&</script>`))
      .toBe("&lt;script&gt;alert(&quot;x&#39;y&quot;)&amp;&lt;/script&gt;");
  });
  it("is safe in attribute position (escapes both quotes)", () => {
    const evil = `" onerror="alert(1)`;
    const out  = `<img alt="${esc(evil)}"/>`;
    // The literal `"` that would break out of alt="..." must be escaped.
    // After esc, no raw `"` appears between the opening and closing alt quotes.
    expect(out).toMatch(/alt="&quot; onerror=&quot;alert\(1\)"/);
    expect(out).not.toMatch(/alt="" onerror=/);
  });
  it("returns empty string for null / undefined", () => {
    expect(esc(null)).toBe("");
    expect(esc(undefined)).toBe("");
  });
});

// ────────────────────────────────────────────────────────────────────
// safeUrl() — strips javascript:/data:
// ────────────────────────────────────────────────────────────────────
describe("safeUrl", () => {
  it("passes http and https URLs through", () => {
    expect(safeUrl("https://zoom.us/j/123")).toBe("https://zoom.us/j/123");
    expect(safeUrl("http://example.com")).toBe("http://example.com");
  });
  it("allows mailto and tel", () => {
    expect(safeUrl("mailto:foo@bar.com")).toBe("mailto:foo@bar.com");
    expect(safeUrl("tel:+5491155555555")).toBe("tel:+5491155555555");
  });
  it("strips javascript: payloads", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("JaVaScRiPt:alert(1)")).toBe("");
  });
  it("strips data: URIs", () => {
    expect(safeUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe("");
  });
  it("strips empty / null", () => {
    expect(safeUrl("")).toBe("");
    expect(safeUrl(null)).toBe("");
    expect(safeUrl(undefined)).toBe("");
  });
  it("trims whitespace before checking", () => {
    expect(safeUrl("   https://x.com   ")).toBe("https://x.com");
  });
});

// ────────────────────────────────────────────────────────────────────
// buildPrintHTML — cover override, multi-entity, travel rows, contacts
// ────────────────────────────────────────────────────────────────────
describe("buildPrintHTML", () => {
  const baseEntity = {
    name: "Templeton",
    sub: "Mark Mobius",
    coverTitle: "Templeton",
    coverNames: [{ name: "Mark Mobius", title: "PM" }],
    coverDate: "April 2026",
    sections: [{
      dayLabel: "Monday, April 20, 2026",
      headerCols: ["Time", "Company / Meeting", "Type", "Location", "Status"],
      rows: [
        { time: "10:00", col1: "YPF", col2: "", col3: "Meeting", col4: "LS Office", col5: "Confirmed" },
      ],
    }],
  };

  it("emits a cover when the first entity has coverNames", () => {
    const html = buildPrintHTML([baseEntity], { eventTitle: "Templeton Roadshow" });
    expect(html).toMatch(/class="cover"/);
    expect(html).toMatch(/Mark Mobius/);
  });

  it("respects meta.cover === false to suppress the cover entirely", () => {
    const html = buildPrintHTML([baseEntity], { cover: false });
    expect(html).not.toMatch(/class="cover"/);
  });

  it("uses meta.coverOverride instead of the first entity when provided", () => {
    const html = buildPrintHTML([baseEntity], {
      coverOverride: {
        title: "Buenos Aires Roadshow",
        names: [{ name: "Templeton", title: "Mark Mobius" }, { name: "Blackrock", title: "Larry Fink" }],
        dateLabel: "April 2026",
      },
    });
    expect(html).toMatch(/Buenos Aires Roadshow/);
    expect(html).toMatch(/Larry Fink/); // second fund on the cover
  });

  it("renders each entity's heading when multiple entities are bundled", () => {
    const second = { ...baseEntity, name: "Blackrock", sub: "Larry Fink", coverNames: [] };
    const html = buildPrintHTML([baseEntity, second], {});
    // Multi-entity ⇒ per-entity <h1>/<h2> headings appear inside the agenda pages
    expect(html.match(/<h1>/g)?.length || 0).toBeGreaterThanOrEqual(2);
  });

  it("renders travel rows from the entity row stream", () => {
    const withTravel = {
      ...baseEntity,
      sections: [{
        ...baseEntity.sections[0],
        rows: [
          { time: "10:00", col1: "YPF", col3: "Meeting", col4: "LS Office", col5: "Confirmed" },
          { travelRow: true, travelText: "Travel from Latin Securities to YPF HQ · approx. 20 min" },
          { time: "11:00", col1: "YPF HQ visit", col3: "Meeting", col4: "HQ", col5: "Confirmed" },
        ],
      }],
    };
    const html = buildPrintHTML([withTravel], {});
    expect(html).toMatch(/class="travel-row"/);
    expect(html).toMatch(/Travel from Latin Securities to YPF HQ/);
  });

  it("only emits the contacts block on the last page", () => {
    const html = buildPrintHTML([baseEntity], {
      contacts: [{ name: "Rodrigo Nistor", role: "S&T", email: "rn@ls.ar" }],
    });
    // Single section ⇒ also the last page ⇒ contacts present.
    expect(html).toMatch(/Rodrigo Nistor/);
    expect(html).toMatch(/LATIN SECURITIES.*CONTACT|Latin Securities — Contact/);
  });
});

// ────────────────────────────────────────────────────────────────────
// rsToEntity → buildPrintHTML XSS smoke test
// ────────────────────────────────────────────────────────────────────
describe("End-to-end PDF XSS", () => {
  it("does not let a malicious company name execute in the rendered HTML", () => {
    const trip = {
      fund: "Templeton",
      visitors: [{ name: "Mark Mobius", title: "PM" }],
      arrivalDate: "2026-04-20",
      departureDate: "2026-04-20",
    };
    const evil = `<script>window.PWNED=1</script>`;
    const cos = [{ id: "co1", name: evil, ticker: "" }];
    const meetings = [{
      id: "m1", date: "2026-04-20", hour: 10, type: "company", companyId: "co1",
      status: "confirmed", location: "ls_office", attendingFundIds: [], travelMinutes: 0,
    }];
    const e = rsToEntity({ trip, meetings }, cos);
    const html = buildPrintHTML([e], {});
    // The opening <script> tag must not survive into the rendered HTML
    expect(html).not.toMatch(/<script>window\.PWNED/);
  });

  it("strips a javascript: meeting link before rendering an anchor", () => {
    const trip = {
      fund: "Templeton", visitors: [{ name: "X" }],
      arrivalDate: "2026-04-20", departureDate: "2026-04-20",
    };
    const meetings = [{
      id: "m1", date: "2026-04-20", hour: 10, type: "company", companyId: "co1",
      status: "confirmed", location: "virtual",
      meetingPlatform: "zoom",
      meetingLink: "javascript:alert(1)",
      attendingFundIds: [], travelMinutes: 0,
    }];
    const e = rsToEntity({ trip, meetings }, [{ id: "co1", name: "Test" }]);
    const html = buildPrintHTML([e], {});
    // No javascript: href should appear anywhere
    expect(html).not.toMatch(/href="javascript:/i);
  });
});

// ────────────────────────────────────────────────────────────────────
// buildBookingPage — public surface, anonymous visitors render this
// ────────────────────────────────────────────────────────────────────
describe("buildBookingPage", () => {
  const trip = {
    fund: "Templeton",
    arrivalDate: "2026-04-20",
    departureDate: "2026-04-21",
    mode: "in_person",
  };

  it("escapes a malicious fund name so it can't break out of <title>", () => {
    const evil = `</title><script>alert(1)</script>`;
    const html = buildBookingPage({ ...trip, fund: evil }, [], [], "");
    // The raw payload must be neutralised before reaching the <title> element.
    // Looking at the rendered title region, the malicious `</title>` should be
    // HTML-escaped to `&lt;/title&gt;`, not present as a literal tag.
    const titleRegion = html.slice(0, html.indexOf("</title>") + 8);
    expect(titleRegion).toMatch(/&lt;\/title&gt;/);
    expect(titleRegion).not.toMatch(/<script>alert\(1\)<\/script>/);
  });

  it("neutralises </script> inside the FUND JS literal so it can't close the script element", () => {
    const breakOut = `</script><script>window.PWNED=1</script>`;
    const html = buildBookingPage({ ...trip, fund: breakOut }, [], [], "");
    // The FUND= literal must use `</script>` (or equivalent) so the
    // HTML tokeniser does not see a premature </script>. A raw `</script>`
    // inside the JS string would let the trailing `<script>window.PWNED=1`
    // execute when the page loads.
    const fundIdx = html.indexOf("const FUND=");
    const region  = html.slice(fundIdx, fundIdx + 200);
    expect(region).not.toMatch(/<\/script>/i);
  });

  it("escapes a malicious officeAddress", () => {
    const evil = `<img src=x onerror=alert(1)>`;
    const html = buildBookingPage(trip, [], [], evil);
    expect(html).not.toMatch(/<img src=x onerror=/);
  });
});
