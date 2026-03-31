#!/usr/bin/env node
/**
 * lint-hooks.cjs — Pre-deploy guard for THREE recurring bugs in this codebase.
 *
 * BUG 1: useState/useEffect/useMemo inside IIFE render block or useMemo callback → BLANK PAGE
 *   Pattern:  {tab==="x" && (()=>{ const [s]=useState() ... })()}
 *   Fix:      Move to App() body before return()
 *
 * BUG 2: <input ref=...> with type="file" inside IIFE → BUTTON DOES NOTHING
 *   Pattern:  ref={someRef} on <input type="file"> inside tab IIFE
 *   Fix:      Move file inputs to root JSX level (always rendered)
 *
 * BUG 3: React.useEffect / React.useState (React not imported as global) → BLANK PAGE ON OPEN
 *   Pattern:  React.useEffect(...) or React.useState(...) instead of useEffect(...)
 *   Fix:      Use the named import directly: useEffect, useState, etc.
 */
const fs   = require('fs');
const path = require('path');

const HOOK_RE       = /\b(useState|useEffect|useCallback|useMemo|useRef)\s*\(/;
const REACT_DOT_RE  = /\bReact\.(useState|useEffect|useCallback|useMemo|useRef)\s*\(/;
const IIFE_OPEN     = /&&\s*\(\s*\(\s*\)\s*=>\s*\{/;
const MEMO_OPEN     = /\buseMemo\s*\(\s*\(\s*\)\s*=>\s*\{|\buseCallback\s*\(/;
const IIFE_CLOSE    = /\}\s*\)\s*\(\s*\)\s*\}/;
const INPUT_FILE_RE = /<input\b[^>]*type=["']file["'][^>]*ref=\{|<input\b[^>]*ref=\{[^>]*type=["']file["']/;

const target = path.resolve(__dirname, '..', 'App.jsx');
if (!fs.existsSync(target)) { console.error('App.jsx not found'); process.exit(1); }

const lines = fs.readFileSync(target, 'utf8').split('\n');
let depth = 0;
const errors1 = [], errors2 = [], errors3 = [];

lines.forEach((line, i) => {
  if (IIFE_OPEN.test(line))  depth++;

  if (depth > 0) {
    const s = line.trim();
    if (!s.startsWith('//') && !s.startsWith('*')) {
      if (HOOK_RE.test(line))                        errors1.push(`  Line ${i+1}: ${s.slice(0,110)}`);
      if (INPUT_FILE_RE.test(line))                  errors2.push(`  Line ${i+1}: ${s.slice(0,110)}`);
    }
  }

  // BUG 3: React.hook anywhere in file (not just IIFE)
  if (REACT_DOT_RE.test(line) && !line.trim().startsWith('//'))
    errors3.push(`  Line ${i+1}: ${line.trim().slice(0,110)}`);

  if (depth > 0 && IIFE_CLOSE.test(line)) depth--;
});

let total = 0;

if (errors1.length) {
  console.error('\n❌ BUG 1 — Hook inside IIFE (BLANK PAGE)\n   Move useState/useEffect to App() body.\n');
  errors1.forEach(e => console.error(e)); total += errors1.length;
}
if (errors2.length) {
  console.error('\n❌ BUG 2 — Hidden file input inside IIFE (BUTTON DOES NOTHING)\n   Move <input type="file" ref=...> to root JSX.\n');
  errors2.forEach(e => console.error(e)); total += errors2.length;
}
if (errors3.length) {
  console.error('\n❌ BUG 3 — React.useEffect/useState (React not a global → CRASH ON OPEN)\n   Use named import: useEffect(...) not React.useEffect(...)\n');
  errors3.forEach(e => console.error(e)); total += errors3.length;
}

if (total === 0) {
  console.log('✅ lint-hooks: OK — no violations found.');
  process.exit(0);
} else {
  console.error(`\n🚫 DEPLOY BLOCKED — ${total} violation(s). Fix before deploying.\n`);
  process.exit(1);
}
