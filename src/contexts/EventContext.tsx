// ── EventContext.tsx — Shared event/roadshow state ──────────────
import { createContext, useContext, ReactNode } from "react";

interface EventContextValue {
  roadshow: any;
  saveRoadshow: (rs: any) => void;
  currentEvent: any;
  config: any;
  tripDays: string[];
  rsCoById: Map<string, any>;
  travelCache: Record<string, any>;
  setTravelCache: (v: any) => void;
  globalDB: any;
  saveGlobalDB: (db: any) => void;
}

const EventCtx = createContext<EventContextValue | null>(null);

export function useEvent(): EventContextValue {
  const ctx = useContext(EventCtx);
  if (!ctx) throw new Error("useEvent must be used within EventProvider");
  return ctx;
}

export function EventProvider({ value, children }: { value: EventContextValue; children: ReactNode }) {
  return <EventCtx.Provider value={value}>{children}</EventCtx.Provider>;
}
