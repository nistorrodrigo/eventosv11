#!/usr/bin/env node
/**
 * lint-hooks.cjs — Pre-deploy guard against React hook-in-IIFE violations.
 *
 * The recurring crash pattern in this codebase:
 *   {tab === "foo" && (()=>{
 *     const [x, setX] = useState(...)   ← ILLEGAL inside IIFE
 *   })()}
 *
 * React requires hooks to be at the TOP LEVEL of App(), not inside
 * nested functions or IIFEs. Symptoms: blank page, no console error.
 * Fix: move the declaration to the App body before return().
 */
const fs   = require('fs');
const path = require('path');

const HOOK_RE    = /\b(useState|useEffect|useCallback|useMemo|useRef)\s*\(/;
const IIFE_OPEN  = /&&\s*\(\s*\(\s*\)\s*=>\s*\{/;
const IIFE_CLOSE = /\}\s*\)\s*\(\s*\)\s*\}/;

const target = path.resolve(__dirname, '..', 'App.jsx');
if (!fs.existsSync(target)) { console.error('App.jsx not found'); process.exit(1); }

const lines = fs.readFileSync(target, 'utf8').split('\n');
let depth = 0, errors = [];

lines.forEach((line, i) => {
  if (IIFE_OPEN.test(line))  depth++;
  if (depth > 0 && HOOK_RE.test(line)) {
    const s = line.trim();
    if (!s.startsWith('//') && !s.startsWith('*'))
      errors.push(`  Line ${i + 1}: ${s.slice(0, 110)}`);
  }
  if (depth > 0 && IIFE_CLOSE.test(line)) depth--;
});

if (!errors.length) {
  console.log('✅ lint-hooks: No hook-in-IIFE violations found. Safe to deploy.');
  process.exit(0);
} else {
  console.error('');
  console.error('❌ lint-hooks: React Hook(s) detected INSIDE an IIFE render block!');
  console.error('');
  console.error('   This WILL cause a blank page (violated Rules of Hooks).');
  console.error('   Move these useState/useEffect calls to App() body before return():');
  console.error('');
  errors.forEach(e => console.error(e));
  console.error('');
  console.error('🚫 DEPLOY BLOCKED — fix the violations above first.');
  console.error('');
  process.exit(1);
}
