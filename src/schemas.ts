// ── schemas.js — Zod validation schemas for core data models ─────
import { z } from "zod";

// ── Contact ──
export const ContactSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Nombre requerido"),
  title: z.string().default(""),
  email: z.string().email("Email inválido").or(z.literal("")).default(""),
  phone: z.string().default(""),
});

// ── Company ──
export const CompanySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Nombre de empresa requerido"),
  ticker: z.string().default(""),
  sector: z.string().default("Other"),
  hqAddress: z.string().default(""),
  contacts: z.array(ContactSchema).default([]),
  notes: z.string().default(""),
  active: z.boolean().default(true),
});

// ── Meeting ──
export const MeetingSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha debe ser YYYY-MM-DD"),
  hour: z.number().min(0).max(24),
  duration: z.number().positive().default(60),
  type: z.enum(["company", "ls_internal", "custom"]).default("company"),
  companyId: z.string().default(""),
  status: z.enum(["confirmed", "tentative", "cancelled"]).default("tentative"),
  location: z.enum(["ls_office", "hq", "custom"]).default("ls_office"),
  locationCustom: z.string().default(""),
  notes: z.string().default(""),
  postNotes: z.string().default(""),
  meetingFormat: z.string().default("Meeting"),
  attendeeIds: z.array(z.string()).default([]),
  feedback: z.object({
    interestLevel: z.number().min(0).max(5).default(0),
    topics: z.array(z.string()).default([]),
    nextStep: z.string().default(""),
    internalNotes: z.string().default(""),
  }).default({}),
  actualAttendees: z.array(z.string()).nullable().default(null),
  icsVersion: z.number().default(1),
  changeLog: z.array(z.object({
    at: z.string(),
    field: z.string(),
    from: z.any().optional(),
    to: z.any().optional(),
  })).default([]),
});

// ── Expense ──
export const ExpenseSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().min(1),
  description: z.string().min(1, "Descripción requerida"),
  amount: z.number().positive("Monto debe ser positivo"),
  currency: z.enum(["ARS", "USD", "EUR", "BRL", "GBP"]),
  paidBy: z.string().default(""),
  notes: z.string().default(""),
  receipt: z.string().nullable().default(null),
  receiptName: z.string().nullable().default(null),
});

// ── Trip ──
export const TripSchema = z.object({
  clientName: z.string().default(""),
  fund: z.string().default(""),
  hotel: z.string().default(""),
  arrivalDate: z.string().default(""),
  departureDate: z.string().default(""),
  meetingDuration: z.number().positive().default(60),
  officeAddress: z.string().default(""),
  visitors: z.array(z.object({
    name: z.string().default(""),
    title: z.string().default(""),
    email: z.string().default(""),
  })).default([]),
});

// ── Roadshow (full) ──
export const RoadshowSchema = z.object({
  trip: TripSchema.default({}),
  meetings: z.array(MeetingSchema).default([]),
  companies: z.array(CompanySchema).default([]),
  expenses: z.array(ExpenseSchema).default([]),
  travelOverrides: z.record(z.number()).default({}),
});

// ── TypeScript Types (inferred from Zod schemas) ──
export type Contact = z.infer<typeof ContactSchema>;
export type Company = z.infer<typeof CompanySchema>;
export type Meeting = z.infer<typeof MeetingSchema>;
export type Expense = z.infer<typeof ExpenseSchema>;
export type Trip = z.infer<typeof TripSchema>;
export type Roadshow = z.infer<typeof RoadshowSchema>;

// ── Validation helpers ──
export function validateMeeting(data: unknown) {
  return MeetingSchema.safeParse(data);
}

export function validateCompany(data: unknown) {
  return CompanySchema.safeParse(data);
}

export function validateExpense(data: unknown) {
  return ExpenseSchema.safeParse(data);
}
