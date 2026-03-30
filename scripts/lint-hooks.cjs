#!/usr/bin/env node
/**
 * lint-hooks.cjs — Pre-deploy guard for TWO recurring blank-page/silent-fail bugs:
 *
 * BUG 1: React Hook inside IIFE render block → blank page crash
 *   Pattern:  {tab==="foo" && (()=>{ const [x]=useState(...) ... })()}
 *   Symptom:  Entire app goes blank when switching tabs
 *   Fix:      Move all useState/useEffect to App() body before return()
 *
 * BUG 2: Ref-triggered hidden <input> inside conditional render → button does nothing
 *   Pattern:  ref={someRef} on <input> inside a tab IIFE + button calls someRef.current?.click()
 *             but the input is only rendered when a specific tab is active
 *   Symptom:  "Importar Excel" and similar buttons silently do nothing on other tabs
 *   Fix:      Place hidden file inputs at the ROOT level of the JSX (always rendered)
 */
const fs   = require('fs');
const path = require('path');

const HOOK_RE    = /\b(useState|useEffect|useCallback|useMemo|useRef)\s*\(/;
const IIFE_OPEN  = /&&\s*\(\s*\(\s*\)\s*=>\s*\{/;
const IIFE_CLOSE = /\}\s*\)\s*\(\s*\)\s*\}/;

// Detect: ref={someRef} on an input that is INSIDE an IIFE block
const REF_INPUT_RE = /\bref=\{[a-zA-Z_$][a-zA-Z0-9_$]*\}/;
const INPUT_RE     = /<input\b/;

const target = path.resolve(__dirname, '..', 'App.jsx');
if (!fs.existsSync(target)) { console.error('App.jsx not found'); process.exit(1); }

const lines = fs.readFileSync(target, 'utf8').split('\n');
let depth = 0;
const errors1 = []; // Hook-in-IIFE violations
const errors2 = []; // Ref-input-in-IIFE violations

lines.forEach((line, i) => {
  if (IIFE_OPEN.test(line))  depth++;

  if (depth > 0) {
    const s = line.trim();
    if (!s.startsWith('//') && !s.startsWith('*')) {
      // BUG 1: hook inside IIFE
      if (HOOK_RE.test(line)) {
        errors1.push(`  Line ${i + 1}: ${s.slice(0, 110)}`);
      }
      // BUG 2: hidden file input with ref inside IIFE
      if (INPUT_RE.test(line) && REF_INPUT_RE.test(line) &&
          (line.includes('type="file"') || line.includes("type='file'"))) {
        errors2.push(`  Line ${i + 1}: ${s.slice(0, 110)}`);
      }
    }
  }

  if (depth > 0 && IIFE_CLOSE.test(line)) depth--;
});

let totalErrors = 0;

if (errors1.length) {
  console.error('\n❌ BUG 1 — React Hook(s) inside IIFE render block (BLANK PAGE)');
  console.error('   Move useState/useEffect to App() body BEFORE return().\n');
  errors1.forEach(e => console.error(e));
  totalErrors += errors1.length;
}

if (errors2.length) {
  console.error('\n❌ BUG 2 — Hidden <input ref=...> inside conditional IIFE (BUTTON DOES NOTHING)');
  console.error('   Move file inputs to the ROOT level of JSX so ref is always in the DOM.\n');
  errors2.forEach(e => console.error(e));
  totalErrors += errors2.length;
}

if (totalErrors === 0) {
  console.log('✅ lint-hooks: OK — no hook-in-IIFE or ref-in-IIFE violations.');
  process.exit(0);
} else {
  console.error(`\n🚫 DEPLOY BLOCKED — ${totalErrors} violation(s) found.\n`);
  process.exit(1);
}
