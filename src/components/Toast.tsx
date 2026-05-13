// ── Toast.jsx — Global toast notification system ──────────────────
import { useState, useEffect, useCallback, createContext, useContext } from "react";

const ToastCtx = createContext(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

// Also export a global imperative API for use outside React components
let _globalToast = () => {};
let _globalToastProgress = () => {};
let _globalToastClear = () => {};
export function toast(msg, type = "info") { _globalToast(msg, type); }
export function toastOk(msg) { _globalToast(msg, "success"); }
export function toastErr(msg) { _globalToast(msg, "error"); }
export function toastWarn(msg) { _globalToast(msg, "warning"); }
// Sticky progress toast keyed by id — call repeatedly to update the same item
// (no stacking). Pair with toastClear(id) when the operation finishes.
export function toastProgress(id, msg) { _globalToastProgress(id, msg); }
export function toastClear(id) { _globalToastClear(id); }

const TOAST_COLORS = {
  success: { bg: "var(--c-success-bg)", border: "#86efac", text: "var(--c-success)", icon: "\u2705" },
  error:   { bg: "var(--c-error-bg)",   border: "#fca5a5", text: "var(--c-error)",   icon: "\u274c" },
  warning: { bg: "var(--c-warning-bg)", border: "#fde047", text: "var(--c-warning)", icon: "\u26a0\ufe0f" },
  info:    { bg: "#e0f2fe",             border: "#7dd3fc", text: "#0c4a6e",          icon: "\u2139\ufe0f" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((msg, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), type === "error" ? 6000 : 3500);
  }, []);

  // Sticky toast — keyed by stable id, updates in place. Does NOT auto-dismiss;
  // caller must call clearToast(id). Used for long-running operations like
  // travel-time geocoding ("Geocodificando 3/10 direcciones...").
  const progressToast = useCallback((id, msg) => {
    setToasts(prev => {
      const i = prev.findIndex(t => t.id === id);
      if (i >= 0) {
        const next = prev.slice();
        next[i] = { ...next[i], msg };
        return next;
      }
      return [...prev, { id, msg, type: "info", sticky: true }];
    });
  }, []);

  const clearToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    _globalToast = addToast;
    _globalToastProgress = progressToast;
    _globalToastClear = clearToast;
  }, [addToast, progressToast, clearToast]);

  const ctx = { toast: addToast, ok: (m) => addToast(m, "success"), err: (m) => addToast(m, "error"), warn: (m) => addToast(m, "warning"), progress: progressToast, clear: clearToast };

  return (
    <ToastCtx.Provider value={ctx}>
      {children}
      <div className="toast-container">
        {toasts.map(t => {
          const c = TOAST_COLORS[t.type] || TOAST_COLORS.info;
          return (
            <div key={t.id} className="toast-item" style={{ background: c.bg, borderColor: c.border, color: c.text }}>
              {c.icon} {t.msg}
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
