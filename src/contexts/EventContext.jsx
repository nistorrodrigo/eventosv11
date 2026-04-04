// ── EventContext.jsx — Shared event/roadshow state ──────────────
import { createContext, useContext } from "react";

const EventCtx = createContext(null);

export function useEvent() {
  const ctx = useContext(EventCtx);
  if (!ctx) throw new Error("useEvent must be used within EventProvider");
  return ctx;
}

// Thin provider — App.jsx passes the values, children consume via useEvent()
export function EventProvider({ value, children }) {
  return <EventCtx.Provider value={value}>{children}</EventCtx.Provider>;
}
