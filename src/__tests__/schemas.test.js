// ── schemas.test.js — Unit tests for Zod validation schemas ──────
import { describe, it, expect } from "vitest";
import { validateMeeting, validateCompany, validateExpense, ContactSchema, MeetingSchema, CompanySchema, ExpenseSchema, TripSchema } from "../schemas.ts";

describe("ContactSchema", () => {
  it("validates a complete contact", () => {
    const result = ContactSchema.safeParse({ id: "rep_1", name: "Juan Pérez", title: "CFO", email: "juan@test.com", phone: "+54 11 1234" });
    expect(result.success).toBe(true);
  });

  it("requires name", () => {
    const result = ContactSchema.safeParse({ id: "rep_1", name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = ContactSchema.safeParse({ id: "rep_1", name: "Test", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("allows empty email", () => {
    const result = ContactSchema.safeParse({ id: "rep_1", name: "Test", email: "" });
    expect(result.success).toBe(true);
  });
});

describe("MeetingSchema", () => {
  it("validates a complete meeting", () => {
    const result = validateMeeting({
      id: "mtg_1", date: "2026-04-21", hour: 10, duration: 60,
      type: "company", companyId: "rc_1", status: "confirmed",
      location: "ls_office"
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid date format", () => {
    const result = validateMeeting({ id: "mtg_1", date: "21/04/2026", hour: 10 });
    expect(result.success).toBe(false);
  });

  it("rejects hour > 24", () => {
    const result = validateMeeting({ id: "mtg_1", date: "2026-04-21", hour: 25 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = validateMeeting({ id: "mtg_1", date: "2026-04-21", hour: 10, status: "maybe" });
    expect(result.success).toBe(false);
  });

  it("applies defaults for optional fields", () => {
    const result = validateMeeting({ id: "mtg_1", date: "2026-04-21", hour: 9 });
    expect(result.success).toBe(true);
    expect(result.data.status).toBe("tentative");
    expect(result.data.duration).toBe(60);
    expect(result.data.feedback?.interestLevel ?? 0).toBe(0);
  });
});

describe("CompanySchema", () => {
  it("validates a company with contacts", () => {
    const result = validateCompany({
      id: "rc_1", name: "Banco Macro", ticker: "BMA", sector: "Financials",
      contacts: [{ id: "rep_1", name: "Juan", title: "CEO", email: "j@bma.com", phone: "" }]
    });
    expect(result.success).toBe(true);
    expect(result.data.contacts).toHaveLength(1);
  });

  it("requires company name", () => {
    const result = validateCompany({ id: "rc_1", name: "" });
    expect(result.success).toBe(false);
  });

  it("defaults active to true", () => {
    const result = validateCompany({ id: "rc_1", name: "Test Co" });
    expect(result.success).toBe(true);
    expect(result.data.active).toBe(true);
  });
});

describe("ExpenseSchema", () => {
  it("validates a complete expense", () => {
    const result = validateExpense({
      id: "exp_1", date: "2026-04-21", category: "🍽 Comida",
      description: "Almuerzo con Pampa", amount: 15000, currency: "ARS"
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative amount", () => {
    const result = validateExpense({
      id: "exp_1", date: "2026-04-21", category: "test",
      description: "test", amount: -100, currency: "USD"
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid currency", () => {
    const result = validateExpense({
      id: "exp_1", date: "2026-04-21", category: "test",
      description: "test", amount: 100, currency: "JPY"
    });
    expect(result.success).toBe(false);
  });

  it("requires description", () => {
    const result = validateExpense({
      id: "exp_1", date: "2026-04-21", category: "test",
      description: "", amount: 100, currency: "USD"
    });
    expect(result.success).toBe(false);
  });
});

describe("TripSchema", () => {
  it("validates with defaults", () => {
    const result = TripSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data.meetingDuration).toBe(60);
    expect(result.data.visitors).toEqual([]);
  });

  it("validates a full trip", () => {
    const result = TripSchema.safeParse({
      clientName: "Impera Capital", fund: "Impera", hotel: "Holiday Inn",
      arrivalDate: "2026-04-20", departureDate: "2026-04-24",
      meetingDuration: 45, officeAddress: "Arenales 707",
      visitors: [{ name: "Gamze Alpar", title: "PM", email: "g@impera.com" }]
    });
    expect(result.success).toBe(true);
    expect(result.data.visitors).toHaveLength(1);
  });
});
