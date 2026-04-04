// ── FocusTrap.jsx — Traps keyboard focus inside modals for a11y ──
import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function FocusTrap({ children, active = true }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const prev = document.activeElement;

    // Focus first focusable element
    const first = el.querySelector(FOCUSABLE);
    if (first) first.focus();

    function handleKey(e) {
      if (e.key !== "Tab") return;
      const focusable = [...el.querySelectorAll(FOCUSABLE)].filter(f => f.offsetParent !== null);
      if (!focusable.length) return;
      const firstF = focusable[0];
      const lastF = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === firstF) { e.preventDefault(); lastF.focus(); }
      } else {
        if (document.activeElement === lastF) { e.preventDefault(); firstF.focus(); }
      }
    }

    el.addEventListener("keydown", handleKey);
    return () => {
      el.removeEventListener("keydown", handleKey);
      // Restore focus
      if (prev && prev.focus) try { prev.focus(); } catch {}
    };
  }, [active]);

  return <div ref={ref}>{children}</div>;
}
