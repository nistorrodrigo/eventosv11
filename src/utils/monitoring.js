// ── monitoring.js — Performance & error monitoring ────────────────
import { onCLS, onFCP, onLCP, onTTFB } from "web-vitals";

const METRICS = [];
const ERRORS = [];

// Track Web Vitals
function logMetric(metric) {
  METRICS.push({ name: metric.name, value: Math.round(metric.value), rating: metric.rating, ts: Date.now() });
  const color = metric.rating === "good" ? "#166534" : metric.rating === "needs-improvement" ? "#b45309" : "#dc2626";
  console.log(`%c[Perf] ${metric.name}: ${Math.round(metric.value)}ms (${metric.rating})`, `color:${color};font-weight:bold`);
}

export function initMonitoring() {
  // Web Vitals
  onCLS(logMetric);
  onFCP(logMetric);
  onLCP(logMetric);
  onTTFB(logMetric);

  // Global error handler
  window.addEventListener("error", (e) => {
    const err = { msg: e.message, file: e.filename?.split("/").pop(), line: e.lineno, col: e.colno, ts: Date.now() };
    ERRORS.push(err);
    console.error(`%c[Error] ${err.msg} (${err.file}:${err.line})`, "color:#dc2626;font-weight:bold");
  });

  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", (e) => {
    const err = { msg: String(e.reason?.message || e.reason || "Unknown"), type: "promise", ts: Date.now() };
    ERRORS.push(err);
    console.error(`%c[Promise] ${err.msg}`, "color:#dc2626;font-weight:bold");
  });

  // Log summary after 10 seconds
  setTimeout(() => {
    if (METRICS.length) {
      const summary = METRICS.map(m => `${m.name}=${m.value}ms(${m.rating})`).join(" · ");
      console.log(`%c[Perf Summary] ${summary}`, "color:#1e5ab0;font-weight:bold;font-size:11px");
    }
  }, 10000);
}

// Get current metrics (for debugging in console)
export function getMetrics() { return { vitals: METRICS, errors: ERRORS }; }
window.__perf = getMetrics;
