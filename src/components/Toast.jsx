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
export function toast(msg, type = "info") { _globalToast(msg, type); }
export function toastOk(msg) { _globalToast(msg, "success"); }
export function toastErr(msg) { _globalToast(msg, "error"); }
export function toastWarn(msg) { _globalToast(msg, "warning"); }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((msg, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), type === "error" ? 6000 : 3500);
  }, []);

  // Register global API
  useEffect(() => { _globalToast = addToast; }, [addToast]);

  const ctx = { toast: addToast, ok: (m) => addToast(m, "success"), err: (m) => addToast(m, "error"), warn: (m) => addToast(m, "warning") };

  const colors = {
    success: { bg: "#dcfce7", border: "#86efac", text: "#166534", icon: "✅" },
    error:   { bg: "#fee2e2", border: "#fca5a5", text: "#991b1b", icon: "❌" },
    warning: { bg: "#fef9c3", border: "#fde047", text: "#854d0e", icon: "⚠️" },
    info:    { bg: "#e0f2fe", border: "#7dd3fc", text: "#0c4a6e", icon: "ℹ️" },
  };

  return (
    <ToastCtx.Provider value={ctx}>
      {children}
      {/* Toast container */}
      <div style={{ position: "fixed", top: 16, right: 16, zIndex: 99999, display: "flex", flexDirection: "column", gap: 8, maxWidth: 420, pointerEvents: "none" }}>
        {toasts.map(t => {
          const c = colors[t.type] || colors.info;
          return (
            <div key={t.id} style={{
              background: c.bg, border: `1px solid ${c.border}`, color: c.text,
              padding: "10px 16px", borderRadius: 10, fontSize: 12, fontFamily: "Calibri,Arial,sans-serif",
              boxShadow: "0 4px 16px rgba(0,0,0,.12)", lineHeight: 1.5, pointerEvents: "auto",
              animation: "toastIn .25s ease-out", whiteSpace: "pre-line",
            }}>
              {c.icon} {t.msg}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </ToastCtx.Provider>
  );
}
