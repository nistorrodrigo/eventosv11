import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import * as XLSX from "xlsx";

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS — static
═══════════════════════════════════════════════════════════════════ */
const ALL_HOURS = [8,9,10,11,12,13,14,15,16,17,18];
const DEFAULT_DAYS = [
  {id:"apr14", short:"Tue Apr 14",   long:"Tuesday, April 14th 2026"},
  {id:"apr15", short:"Wed Apr 15",   long:"Wednesday, April 15th 2026"},
];
// Derived helpers — populated from config at runtime, but also available statically
const DAYS_STATIC  = ["apr14","apr15"];
const DAY_LONG_S   = { apr14:"Tuesday, April 14th 2026",   apr15:"Wednesday, April 15th 2026" };
const DAY_SHORT_S  = { apr14:"Tue Apr 14",                 apr15:"Wed Apr 15" };
// Runtime versions (replaced per-event below via getDays helper)
function getDays(cfg){ return cfg?.days?.length ? cfg.days : DEFAULT_DAYS; }
function getDayIds(cfg){ return getDays(cfg).map(d=>d.id); }
function getDayLong(cfg){ const m={}; getDays(cfg).forEach(d=>m[d.id]=d.long); return m; }
function getDayShort(cfg){ const m={}; getDays(cfg).forEach(d=>m[d.id]=d.short); return m; }
const slotDay   = id => id.split("-")[0];
const slotHour  = id => parseInt(id.split("-")[1]);
const hourLabel = h  => h===12?"12:00 PM":h>12?`${h-12}:00 PM`:`${h}:00 AM`;
const slotLabel = id => hourLabel(slotHour(id));
const makeRooms = n  => Array.from({length:n},(_,i)=>`Room ${i+1}`);
const getRooms  = cfg => { const n=(cfg||DEFAULT_CONFIG).numRooms; const names=(cfg||DEFAULT_CONFIG).roomNames||{}; return Array.from({length:n},(_,i)=>names[i]||`Room ${i+1}`); };
const makeSlots = (hrs,cfg)=> getDayIds(cfg).flatMap(d=>hrs.map(h=>`${d}-${h}`));

const DEFAULT_CONFIG = {
  numRooms : 12,
  hours    : [9,10,11,12,13,14,15,16,17],
  coBlocks : {},
  days     : DEFAULT_DAYS,
  eventTitle   : "",
  eventType    : "LS Conference",  // free text: LS Conference / Investor Conference / Corporate Meetings
  eventDates   : "April 14–15, 2026",
  venue        : "The Langham, New York, Fifth Avenue",
  contacts     : [
    {name:"Daniela Ramos", role:"Executive Assistant", email:"Daniela.ramos@latinsecurities.ar", phone:"+54-911-6193-7367"},
    {name:"Rodrigo Nistor", role:"Institutional Sales", email:"Rodrigo.nistor@latinsecurities.ar", phone:"+54-911-6493-8815"},
    {name:"Martin Tapia",   role:"Director",            email:"Martin.tapia@latinsecurities.ar",  phone:"+54-911-5064-1807"},
  ], // [{name, role, email, phone}]
  dinners      : [], // [{id, name, restaurant, address, day, time, companies:[coId]}]
};

function parseAvail(raw, hours, cfg){
  if(!raw||!hours?.length) return [];
  const allSlots=makeSlots(hours,cfg); const ids=new Set();
  for(const p of raw.toLowerCase().split(";").map(s=>s.trim()).filter(Boolean)){
    if(p.includes("all")){allSlots.forEach(s=>ids.add(s));continue;}
    const day=p.includes("apr - 14")||p.includes("apr 14")?"apr14":p.includes("apr - 15")||p.includes("apr 15")?"apr15":null;
    const period=p.includes("morning")?"morning":p.includes("afternoon")?"afternoon":null;
    if(!day) continue;
    hours.forEach(h=>{const m=h<=12;if(!period||(period==="morning"&&m)||(period==="afternoon"&&!m)) ids.add(`${day}-${h}`);});
  }
  return allSlots.filter(s=>ids.has(s));
}

/* ═══════════════════════════════════════════════════════════════════
   COMPANIES
═══════════════════════════════════════════════════════════════════ */
const COMPANIES_INIT = [
  {id:"BMA",   name:"Banco Macro",          ticker:"BMA",   sector:"Financials", hqAddress:"Av. Eduardo Madero 1182, CABA"},
  {id:"BBAR",  name:"BBVA Argentina",        ticker:"BBAR",  sector:"Financials", hqAddress:"Av. Leandro N. Alem 815, Catalinas, CABA"},
  {id:"GGAL",  name:"Grupo Fin. Galicia",    ticker:"GGAL",  sector:"Financials", hqAddress:"Tte. Gral. Perón 430, CABA"},
  {id:"SUPV",  name:"Grupo Supervielle",     ticker:"SUPV",  sector:"Financials", hqAddress:"Bartolomé Mitre 434, CABA"},
  {id:"BYMA",  name:"BYMA",                  ticker:"BYMA",  sector:"Financials"},
  {id:"A3",    name:"A3 Mercados",           ticker:"A3",    sector:"Financials"},
  {id:"PAM",   name:"Pampa Energía",         ticker:"PAM",   sector:"Energy",     hqAddress:"Maipú 1, CABA"},
  {id:"YPF",   name:"YPF",                   ticker:"YPF",   sector:"Energy",     hqAddress:"Macacha Güemes 515, Puerto Madero, CABA"},
  {id:"YPFL",  name:"YPF Luz",               ticker:"YPFL",  sector:"Energy",     hqAddress:"Macacha Güemes 515, Piso 3, CABA"},
  {id:"VIST",  name:"Vista Energy",          ticker:"VIST",  sector:"Energy",     hqAddress:"Av. del Libertador 101, Piso 12, Vicente López"},
  {id:"CEPU",  name:"Central Puerto",        ticker:"CEPU",  sector:"Energy",     hqAddress:"Av. Tomás A. Edison 2701, Puerto Madero, CABA"},
  {id:"EDN",   name:"Edenor",                 ticker:"EDN",   sector:"Energy",     hqAddress:"Av. del Libertador 6363, Núñez, CABA"},
  {id:"TGS",   name:"TGS",                   ticker:"TGS",   sector:"Energy",     hqAddress:"Cecilia Grierson 355, Piso 26, CABA"},
  {id:"GNNEIA",name:"Genneia",               ticker:"GNNEIA",sector:"Energy",     hqAddress:"Nicolás Repetto 3676, Piso 3, Olivos, Bs. As."},
  {id:"MSU",   name:"MSU Energy",            ticker:"MSU",   sector:"Energy",     hqAddress:"Av. Corrientes 222, Piso 10, CABA"},
  {id:"CAAP",  name:"Corporación América",   ticker:"CAAP",  sector:"Infra",      hqAddress:"Honduras 5663, CABA"},
  {id:"IRS",   name:"IRSA / Cresud",         ticker:"IRS",   sector:"Real Estate",hqAddress:"Della Paolera 200, Catalinas, CABA"},
  {id:"LOMA",  name:"Loma Negra",            ticker:"LOMA",  sector:"Infra",      hqAddress:"Cecilia Grierson 355, Piso 4, CABA"},
  {id:"TEO",   name:"Telecom Argentina",     ticker:"TEO",   sector:"TMT",        hqAddress:"Av. Alicia Moreau de Justo 50, CABA"},
  {id:"TGNO4", name:"TGN",                   ticker:"TGNO4", sector:"Energy",     hqAddress:"Don Bosco 3672, Piso 5, CABA"},
  {id:"TRAN",  name:"Transener",              ticker:"TRAN",  sector:"Energy",     hqAddress:"Av. Paseo Colón 728, Piso 6, CABA"},
  {id:"CGC",   name:"CGC",                    ticker:"CGC",   sector:"Energy",     hqAddress:"Av. Leandro N. Alem 1180, Piso 11, CABA"},
  {id:"CAPEX", name:"CAPEX",                  ticker:"CAPEX", sector:"Energy",     hqAddress:"Av. Santa Fe 94, Piso 7, CABA"},
    {id:"LSCM",  name:"LS Corp & Macro",          ticker:"LSCM",  sector:"LS"},
];
const CO_MAP = {
  "banco macro (bma)":"BMA","banco macro":"BMA",
  "bbva argentina (bbar)":"BBAR","bbva argentina":"BBAR",
  "grupo financiero galicia (ggal)":"GGAL","grupo financiero galicia":"GGAL",
  "grupo supervielle (supv)":"SUPV","grupo supervielle":"SUPV",
  "byma (bolsas y mercados argentinos)":"BYMA","byma":"BYMA",
  "a3 mercados":"A3","a3":"A3",
  "pampa energía (pam)":"PAM","pampa energia (pam)":"PAM","pampa energía":"PAM","pampa energia":"PAM",
  "ypf":"YPF","ypf luz":"YPFL",
  "vista (vist)":"VIST","vista energy (vist)":"VIST","vista":"VIST",
  "central puerto (cepu)":"CEPU","central puerto":"CEPU",
  "edenor (edn)":"EDN","edenor":"EDN","transportadora de gas del sur (tgs)":"TGS","transportadora de gas del sur":"TGS","tgs":"TGS",
  "genneia (gnneia)":"GNNEIA","genneia":"GNNEIA",
  "msu energy":"MSU","msu":"MSU",
  "corporación américa (caap)":"CAAP","corporacion america (caap)":"CAAP","corporación america (caap)":"CAAP",
  "irsa (irs) - cresud (cresy)":"IRS","irsa (irs)":"IRS","cresud (cresy)":"IRS","irsa":"IRS",
  "loma negra (loma)":"LOMA","loma negra":"LOMA",
  "telecom argentina (teo)":"TEO","telecom argentina":"TEO",
  "ls - rodrigo nistor & barabara guerezta - corporate & macro/sovereign overview":"LSCM",
  "ls - rodrigo nistor & barbara guerezta - corporate & macro/sovereign overview":"LSCM",
  "ls corp & macro":"LSCM","ls corporate & macro":"LSCM","ls corp & macro/sovereign":"LSCM",
  "ls corporate":"LSCM","ls macro":"LSCM","lscm":"LSCM",
};
const resolveCo = raw => CO_MAP[raw.trim().toLowerCase()]||null;
const SEC_CLR   = {Financials:"#3399ff",Energy:"#ff8269",Infra:"#acd484","Real Estate":"#23a29e",TMT:"#ebaca2",LS:"#c9a227"};

function capitalizeName(str){
  if(!str) return "";
  return str.trim().split(/\s+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ");
}


/* ═══════════════════════════════════════════════════════════════════
   FUZZY FUND MATCHING
   Strips noise words (Inc, LLC, Capital, etc.) and compares.
   Returns canonical name (the longer/first seen) if similar enough.
═══════════════════════════════════════════════════════════════════ */
const FUND_NOISE = /\b(inc\.?|llc\.?|ltd\.?|l\.p\.?|lp|corp\.?|co\.?|capital|asset|management|mgmt|advisors?|advisory|partners?|group|fund|funds|investments?|associates?|am|global|international|intl)\.?\b/gi;

function normalizeFund(name){
  return (name||"").toLowerCase().replace(FUND_NOISE,"").replace(/[^a-z0-9]+/g," ").trim();
}

function buildFundAliasMap(investors){
  // Returns {rawFundName → canonicalFundName}
  // Groups funds whose normalized names are identical or very similar
  const seen = []; // [{raw, norm}]
  const aliasMap = {};
  investors.forEach(inv => {
    if(!inv.fund) return;
    const raw = inv.fund;
    if(aliasMap[raw]) return; // already mapped
    const norm = normalizeFund(raw);
    if(!norm) { aliasMap[raw]=raw; return; }
    // Find existing entry with same normalized name
    const match = seen.find(s => s.norm === norm);
    if(match){
      aliasMap[raw] = match.raw; // map this variant to canonical
    } else {
      seen.push({raw, norm});
      aliasMap[raw] = raw; // canonical of itself
    }
  });
  return aliasMap;
}


/* ═══════════════════════════════════════════════════════════════════
   TITLE / POSITION NORMALIZER
═══════════════════════════════════════════════════════════════════ */
const TITLE_MAP = [
  [/^managing direc(tor)?\b/i, "Managing Director"],
  [/^mng\.?\s*dir(ector)?\b/i, "Managing Director"],
  [/^md\b/i, "Managing Director"],
  [/^chief executive/i, "Chief Executive Officer"],
  [/^ceo\b/i, "CEO"],
  [/^cfo\b/i, "CFO"],
  [/^cio\b/i, "CIO"],
  [/^coo\b/i, "COO"],
  [/^cto\b/i, "CTO"],
  [/^vp\b/i, "VP"],
  [/^evp\b/i, "EVP"],
  [/^svp\b/i, "SVP"],
  [/^exec(utive)?\s*dir(ector)?\b/i, "Executive Director"],
  [/^exec(utive)?\s*vp\b/i, "Executive VP"],
  [/^sr\.?\s*vp\b/i, "Senior VP"],
  [/^sr\.?\s*managing\b/i, "Senior Managing"],
  [/^dir(ector)?\b(?!\s+of)/i, "Director"],
  [/^portfolio\s*mgr\b/i, "Portfolio Manager"],
  [/^port(\.)?\s*mgr\b/i, "Portfolio Manager"],
  [/^pm\b/i, "Portfolio Manager"],
  [/^fund\s*mgr\b/i, "Fund Manager"],
  [/^analyst\b/i, "Analyst"],
  [/^sr\.?\s*analyst\b/i, "Senior Analyst"],
  [/^research\s*analyst\b/i, "Research Analyst"],
  [/^assoc(iate)?\b/i, "Associate"],
  [/^pres(ident)?\b/i, "President"],
  [/^chairman\b/i, "Chairman"],
  [/^partner\b/i, "Partner"],
  [/^gen(eral)?\s*partner\b/i, "General Partner"],
  [/^head\s*of\b/i, "Head of"],
];

function normalizePosition(raw){
  if(!raw) return "";
  const trimmed = raw.trim();
  for(const [rx, replacement] of TITLE_MAP){
    if(rx.test(trimmed)){
      // Replace the matched prefix, preserve the rest
      const rest = trimmed.replace(rx, "").trim();
      return rest ? `${replacement} ${rest}` : replacement;
    }
  }
  // Default: capitalize each word
  return trimmed.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function normalizeFundName(raw){
  if(!raw) return "";
  // Capitalize each significant word, preserve known acronyms
  return raw.trim().split(/\s+/).map((w,i) => {
    // Keep all-caps acronyms (LP, LLC, AM, etc.) as-is if short
    if(w.length <= 4 && w === w.toUpperCase() && /^[A-Z]+\.?$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}


function normalizeAUM(raw){
  if(!raw) return "";
  // Already formatted
  if(/^US\$[\d.,]+(mn|bn|tn)$/i.test(raw.trim())) return raw.trim();
  // Extract number
  const s = raw.replace(/,/g,"").toLowerCase().trim();
  const m = s.match(/[\$us\s]*([\d.]+)\s*(trillion|billion|million|mn|bn|tn|mm|b|t|m)?/i);
  if(!m) return raw.trim(); // can't parse, return as-is
  let num = parseFloat(m[1]);
  const unit = (m[2]||"").toLowerCase();
  // Convert to a base number in millions
  if(unit==="trillion"||unit==="tn"||unit==="t") num = num * 1e6;
  else if(unit==="billion"||unit==="bn"||unit==="b") num = num * 1e3;
  else if(unit==="million"||unit==="mn"||unit==="mm"||unit==="m") num = num;
  else {
    // Bare number — guess by magnitude
    if(num >= 1e12) num = num / 1e6;
    else if(num >= 1e9) num = num / 1e6;
    else if(num >= 1e6) num = num / 1e6;
    else if(num >= 1e3) num = num; // already in millions probably
    // else leave as-is in millions
  }
  // Format
  if(num >= 1e6) return `US$${(num/1e6).toFixed(num%1e6===0?0:1)}tn`;
  if(num >= 1e3) return `US$${(num/1e3).toFixed(num%1e3===0?0:1)}bn`;
  return `US$${num % 1 === 0 ? num : num.toFixed(1)}mn`;
}

/* ═══════════════════════════════════════════════════════════════════
   SCHEDULING
═══════════════════════════════════════════════════════════════════ */
function effectiveSlots(inv, allSlots){
  return (allSlots||[]).filter(s=>(inv.slots||[]).includes(s)&&!(inv.blockedSlots||[]).includes(s));
}

function buildRoomMap(investors, numRooms, rooms){
  const demand={};COMPANIES_INIT.forEach(c=>{demand[c.id]=0;});
  investors.forEach(inv=>(inv.companies||[]).forEach(cid=>{demand[cid]=(demand[cid]||0)+1;}));
  const sorted=[...COMPANIES_INIT].sort((a,b)=>demand[b.id]-demand[a.id]);
  const map={};sorted.slice(0,numRooms).forEach((c,i)=>{map[c.id]=rooms[i];});
  return map;
}

function runSchedule(investors, fundGrouping, cfg){
  const {numRooms,hours,coBlocks={}} = cfg||DEFAULT_CONFIG;
  const rooms    = getRooms(cfg);
  const allSlots = makeSlots(hours,cfg);
  const dayIds   = getDayIds(cfg);
  const dayLong  = getDayLong(cfg);
  const dayShort = getDayShort(cfg);
  const fixedRoom= buildRoomMap(investors,numRooms,rooms);
  // Local index map — runSchedule is outside App so can't access the useMemo invById
  const invById  = new Map(investors.map(i=>[i.id,i]));
  const fundMap  = {};
  investors.forEach(inv=>{if(inv.fund){if(!fundMap[inv.fund])fundMap[inv.fund]=[];fundMap[inv.fund].push(inv.id);}});
  const processed=new Set(); const reqs=[];
  investors.forEach(inv=>{
    (inv.companies||[]).forEach(coId=>{
      const key=`${inv.id}::${coId}`; if(processed.has(key)) return; processed.add(key);
      const fundmates=(fundMap[inv.fund]||[]).filter(id=>id!==inv.id&&invById.get(id)?.companies?.includes(coId));
      const grouped=inv.fund&&fundmates.length>0&&(fundGrouping[inv.fund]!==false);
      if(grouped){fundmates.forEach(id=>processed.add(`${id}::${coId}`));reqs.push({invIds:[inv.id,...fundmates],coId});}
      else reqs.push({invIds:[inv.id],coId});
    });
  });
  reqs.sort((a,b)=>{
    const sa=a.invIds.reduce((s,id)=>{const inv=invById.get(id);return s.filter(sl=>effectiveSlots(inv,allSlots).includes(sl));},allSlots);
    const sb=b.invIds.reduce((s,id)=>{const inv=invById.get(id);return s.filter(sl=>effectiveSlots(inv,allSlots).includes(sl));},allSlots);
    return sa.length-sb.length;
  });
  const invBusy={};investors.forEach(i=>{invBusy[i.id]=new Set();});
  const coBusy={};COMPANIES_INIT.forEach(c=>{coBusy[c.id]=new Set();});
  Object.entries(coBlocks).forEach(([coId,blocked])=>{if(!coBusy[coId])coBusy[coId]=new Set();(blocked||[]).forEach(s=>coBusy[coId].add(s));});
  const roomBusy={};const meetings=[];const unscheduled=[];
  // coRoom[coId] = permanent room assignment for this company (set on first meeting, never changes unless forced)
  const coRoom={...fixedRoom};

  // ── Helpers (js-combine-iterations: single-pass day buckets) ────
  // Instead of filtering meetings[] on every call, maintain live buckets
  // meetByDay[dayId] = meetings[] for that day — O(1) access
  const meetByDay={};
  const coIdxOnDay=(coId,dayId)=>(meetByDay[dayId]||[]).filter(m=>m.coId===coId).map(m=>allSlots.indexOf(m.slotId));
  const roomDayCount=(room,dayId)=>(meetByDay[dayId]||[]).filter(m=>m.room===room).length;
  const roomDayDominant=(room,dayId)=>{
    const ms=(meetByDay[dayId]||[]).filter(m=>m.room===room);
    if(!ms.length) return{coId:null,count:0};
    const cnt={};ms.forEach(m=>{cnt[m.coId]=(cnt[m.coId]||0)+1;});
    const [coId,count]=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];
    return{coId,count};
  };
  // Keep meetByDay in sync when we push a meeting (called after each assignment)
  const registerMeeting=(m)=>{const d=slotDay(m.slotId);if(!meetByDay[d])meetByDay[d]=[];meetByDay[d].push(m);};

  // ── Pre-compute expected meetings per company ─────────────────────
  // (used to determine which companies are "heavy" and should own a room)
  const reqsPerCo={};
  reqs.forEach(r=>{reqsPerCo[r.coId]=(reqsPerCo[r.coId]||0)+1;});
  const HEAVY_THRESHOLD=5; // companies with this many+ meetings should own their room

  for(const req of reqs){
    let shared=allSlots;
    for(const id of req.invIds){const inv=invById.get(id);shared=shared.filter(s=>effectiveSlots(inv,allSlots).includes(s)&&!invBusy[id].has(s));}
    shared=shared.filter(s=>!coBusy[req.coId].has(s));
    if(!shared.length){unscheduled.push(req);continue;}

    // ── Score slots ───────────────────────────────────────────────────
    // Check if ALL investors in this req are fully unconstrained (no time restrictions)
    const allFreeSlots = makeSlots(hours,cfg);
    const isUnconstrained = req.invIds.every(id=>{
      const inv=invById.get(id);
      return effectiveSlots(inv,allFreeSlots).length>=allFreeSlots.length;
    });

    const scored=shared.map(slotId=>{
      const day=slotDay(slotId);
      const idx=allSlots.indexOf(slotId);
      if(isUnconstrained){
        // No investor restrictions: always prefer morning (earliest slot first)
        // Clustering is secondary — don't let it push to afternoon
        const existing=coIdxOnDay(req.coId,day);
        const dist=existing.length===0?0:Math.min(...existing.map(ei=>Math.abs(ei-idx)));
        return{slotId,dist:0,adj:dist,idx};
      } else {
        // Has restrictions: cluster adjacent to existing company meetings first
        const existing=coIdxOnDay(req.coId,day);
        const dist=existing.length===0?999:Math.min(...existing.map(ei=>Math.abs(ei-idx)));
        return{slotId,dist,adj:dist,idx};
      }
    });
    // Unconstrained: sort purely by slot time (morning first)
    // Constrained: sort by proximity to existing meetings, then by time
    scored.sort((a,b)=>a.dist!==b.dist?a.dist-b.dist:a.idx!==b.idx?a.idx-b.idx:a.adj-b.adj);

    let placed=false;
    const tryPlace=(slotId,room)=>{
      const id=`m-${Date.now()}-${Math.random().toString(36).slice(2,5)}`;
      const nm={id,invIds:req.invIds,coId:req.coId,slotId,room};
      meetings.push(nm);registerMeeting(nm);
      req.invIds.forEach(invId=>invBusy[invId].add(slotId));
      coBusy[req.coId].add(slotId);roomBusy[`${room}::${slotId}`]=true;
      if(!coRoom[req.coId]) coRoom[req.coId]=room; // lock room on first assignment
      placed=true;
    };

    // ── PASS 1: use company's locked room (no exceptions) ────────────
    if(coRoom[req.coId]){
      for(const {slotId} of scored){
        if(!roomBusy[`${coRoom[req.coId]}::${slotId}`]){tryPlace(slotId,coRoom[req.coId]);break;}
      }
    }

    // ── PASS 2: pick a room that avoids "heavy company" rooms ─────────
    // A heavy company has ≥HEAVY_THRESHOLD expected meetings and owns their room all day.
    // New company should take a light/empty room instead.
    if(!placed){
      for(const {slotId} of scored){
        const day=slotDay(slotId);
        const freeRooms=rooms.filter(r=>!roomBusy[`${r}::${slotId}`]);
        if(!freeRooms.length) continue;
        // Sort free rooms: prefer rooms with fewest meetings today AND not dominated by a heavy company
        const ranked=freeRooms.map(r=>{
          const{coId:dom,count}=roomDayDominant(r,day);
          const isHeavyOther=dom&&dom!==req.coId&&(reqsPerCo[dom]||0)>=HEAVY_THRESHOLD;
          const total=roomDayCount(r,day);
          return{r,penalty:isHeavyOther?1000:0,total};
        });
        ranked.sort((a,b)=>a.penalty!==b.penalty?a.penalty-b.penalty:a.total-b.total);
        const room=ranked[0].r;
        tryPlace(slotId,room);break;
      }
    }

    // ── PASS 3: last resort — any free room ───────────────────────────
    if(!placed){
      for(const {slotId} of scored){
        const room=rooms.find(r=>!roomBusy[`${r}::${slotId}`])||null;
        if(room){tryPlace(slotId,room);break;}
      }
    }

    if(!placed) unscheduled.push(req);
  }
  return{meetings,unscheduled,fixedRoom};
}

/* ═══════════════════════════════════════════════════════════════════
   PERSISTENCE — localStorage (works in real browser / Vercel)
═══════════════════════════════════════════════════════════════════ */
const LS_KEY    = "arginny_events_v1";
const LS_DB_KEY = "ls_global_db_v1";
function loadEvents(){try{return JSON.parse(localStorage.getItem(LS_KEY)||"[]");}catch{return[];}}
function saveEvents(events){try{localStorage.setItem(LS_KEY,JSON.stringify(events));}catch{}}
function loadDB(){try{return JSON.parse(localStorage.getItem(LS_DB_KEY)||'{"companies":[],"investors":[]}');}catch{return{companies:[],investors:[]};}}
function saveDB(db){try{localStorage.setItem(LS_DB_KEY,JSON.stringify(db));}catch{}}

/* ═══════════════════════════════════════════════════════════════════
   ZIP
═══════════════════════════════════════════════════════════════════ */
const CRC_TBL=(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;t[i]=c;}return t;})();
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=(c>>>8)^CRC_TBL[(c^b[i])&0xFF];return(c^0xFFFFFFFF)>>>0;}
function u16(n){return[n&0xFF,(n>>8)&0xFF];}function u32(n){return[n&0xFF,(n>>8)&0xFF,(n>>16)&0xFF,(n>>24)&0xFF];}
function cat(...arrs){const total=arrs.reduce((s,a)=>s+a.length,0);const out=new Uint8Array(total);let i=0;for(const a of arrs){out.set(a,i);i+=a.length;}return out;}
function buildZip(files){
  const enc=new TextEncoder();const parts=[];const cdirs=[];let offset=0;
  for(const f of files){
    const name=enc.encode(f.name);const data=f.data instanceof Uint8Array?f.data:enc.encode(f.data);
    const crc=crc32(data);const sz=data.length;
    const local=new Uint8Array([0x50,0x4B,0x03,0x04,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(sz),...u32(sz),...u16(name.length),0,0,...name,...data]);
    const cdir=new Uint8Array([0x50,0x4B,0x01,0x02,20,0,20,0,0,0,0,0,0,0,0,0,...u32(crc),...u32(sz),...u32(sz),...u16(name.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(offset),...name]);
    parts.push(local);cdirs.push(cdir);offset+=local.length;
  }
  const cdOff=offset;const cdData=cat(...cdirs);
  const eocd=new Uint8Array([0x50,0x4B,0x05,0x06,0,0,0,0,...u16(files.length),...u16(files.length),...u32(cdData.length),...u32(cdOff),0,0]);
  return cat(...parts,cdData,eocd).buffer;
}
function downloadBlob(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}

/* ═══════════════════════════════════════════════════════════════════
   EXPORT HTML builders
═══════════════════════════════════════════════════════════════════ */
const esc=s=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

function buildWordHTML(name,sub,sections,meta={}){
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(name)}</title>
<style>@page{size:8.5in 11in;margin:1in}body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a}
.ls-hdr{display:table;width:100%;border-bottom:3pt solid #3399ff;padding-bottom:10px;margin-bottom:18px}
.ls-logo{display:table-cell;vertical-align:middle}
.ev{display:table-cell;text-align:right;vertical-align:middle;padding-left:20px}
.ev-t{font-size:13pt;font-weight:700;color:#1e5ab0}.ev-s{font-size:9pt;color:#666;margin-top:2px}
h1{font-size:18pt;font-weight:700;color:#1e5ab0;margin:0 0 4px}h2{font-size:10.5pt;color:#666;margin:0 0 16px;border-bottom:1px solid #dde;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
.dh{background:#1e5ab0;color:#fff;font-weight:700;padding:6px 12px;font-size:10.5pt}
.th{background:#3399ff;color:#fff;padding:6px 10px;text-align:left;font-size:9.5pt}
.even td{background:#f3f5fb}td{padding:8px 10px;border-bottom:1px solid #dde;vertical-align:top}
.tt{font-weight:700;color:#1e5ab0;white-space:nowrap;width:72px}.tr{font-style:italic;width:80px}</style></head>
<body>
<div class="ls-hdr"><div class="ls-logo"><img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABQAPcDASIAAhEBAxEB/8QAHQAAAgMAAwEBAAAAAAAAAAAAAAcFBggBAwQCCf/EAE0QAAECBQIDAggHDAgHAQAAAAECAwAEBQYRBxIIEyExQRQVIjJRYXF1CTc4coGxshYXIzNCUnN2kaGztBg0NTZDdILBJ1NVlKK10/D/xAAaAQACAwEBAAAAAAAAAAAAAAAAAQIDBAYF/8QALhEAAgIBAwEGBQQDAAAAAAAAAAECAxEEEiExBRNBYYGxMjM0UXEiQnLBkaHR/9oADAMBAAIRAxEAPwDZcEEEABBBBAAQR5qnPydNk1zc9MIYYR2qUf3D0n1CKDUtVJVt4op9KcfQP8R13Zn6AD9ca9Nob9T8qOTPdqqqPmSwMeCKpYV2uXO5OIckUS3g4QRtc3bt2fUPRFriq+idE3XYsNFlVsLoKcHwEEUbXHURnS+xHLqfpTlTQiZbY5CHg0Tvz13EHsx6InNPbjRd9kUa525RUoiqSjc0lhS95bChnbnAz7cRDZLbu8CefAnYIIzbePFXK0O7bhokhYNSrDFCmXGJmdYm8IGxewrVhs7U7gRkmHXVO14igbS6mkoIoNA1Ll65oj982m0h99Hi96bFPQ5ucUtoqCmgoDqdyCM4+iExP8XUxIS5mJ7SWuyrIIBcemihIJ7BktYicNPZNtJdAckjUsEZdluLWdmpdExLaQ3A+y4NyHG5gqSoekENYMMfVDWlqx9VbUsRduLnlXCqXSJsTgbDHNfLXmbDuxjPaM9kD01qeGhbkNuCFhxCavS2kNGpdRmaE7VxUJhbAQ3MBrZtTuzkpOY6OH3WmnatorLbNGeos7SnGw7LPPhxSkr3YUPJT2FKgRjp09MR7mezvMcDys4GtBCovrWeWtbWu39M3KA9NPVlDCkzqZkJS1zXFo6o2knGzPaO2GvEZQlFJvxDIQQQRAYQQQQAEEEEABBBBAAQQQQAEEEEABBBBABTNT7/AJOxEU9c3T35zw0uBPKWE7dm3Oc/Ois0XXi1JyZSzPydQpyVHHNWkOIT7dp3fsBiE4tPxFufOmfqahBx0mg7M0+o00ZzXLz4+Z5Op1dldriug+tQ7iNfrizLvb5BjyJfafJUO9f0/ViK1Hy2AEJA7ABH1HU0UxprVcOiOctslbNzl1YytC/6xVvmNfWuGjCu0L/H1b5rX1rhoxw/bf1s/T2R1PZf0sfX3YhOPH4gZj3nLfWqL7w5/ETZXueX+wIoXHj8QMx7zlvrVF94c/iJsr3PL/YEZZfTL8/0bv3FruysMW9a1Wr8zjkU2Sem3Ae9LaCoj90ZU4O7LcuzR3UmpVEByZulbtPDqx1yGlKKx/rfz7UeqGlxs3F4h0BqrCHNj9XfZp7Zz1wpW9f7UNrH0wm9Fb+1nsXTWk29QtFp6oyCEKfbnFMP5mA6ouBfQYxhQA9QEWUVy7huPVv2E3yXn4Pmvrm9Nq3bEwSJijVLeEK6FDbycgY+e27+2LBx2fJ+nPeEr9swnuEqtVah8T9w0Wv0Z6gTNxsPvGmupUgsu7vCEJAV1wGy5j1EQ4eOz5P057wlftmJWRxq4v74Yk/0lz4afiEsv3U1/vCK4qvla6U/pqf/AD5h68NPxCWX7qa/3hFcVXytdKf01P8A58xGj6iXqN/CSHwjP9y7U94u/wAOI6S/4VcXdAqA/A0W+aay073JDziUpP085CFE9wdMSPwjP9y7U94u/wAOJnjDtR2saCUW6JAKTUbZ5E0hxHnpZWlKXMejB5a8+hBiyqS7uEX0llCfVsq2vfy5dOv0Mh/MvRrmMO3DdbV78Tmjl1NFO6oU2mreCexLwmX0upHsWlQ+iNxRRqk4xgn9iUfEIIIIxkgggggAIIIIACCCCAAggggAIIIIACCCCABF8Wn9Xtz50z9TUIOH5xafiLb+dM/U1CDjtOyPpIevuzwNd8+Xp7DUT5o9kcxwnzR7I5j3jwRlaF/j6t81r61w0YWehjKwiqzBB2EtISfSRuJ+sfthmRwXbTzrZ+nsjruzFjSx9fdlC1405++lYDlqeOPFG+Zaf8J8G5+NhPTbvT257cwj5bhHuGWYRLy+tdUZZbTtQ23TXEpSPQAJnAEOjX7VWl6TWamszkqqfnpp3kSMmlezmrxklSsHalI7Tg9oHfChomoXFjXGG6xStMqB4vmUhxhqa2snYRkHDkyhfZ3kD2Rnod6h+lpLzx/ZsljJJV3hhqda0/o1oVHU+amGqfUZiecmHaYVrfLiW0pT5T527QheDk539gx10bKsMysq1Ky7YbZZQG20DsSkDAH7IoWiNw6i3BR6i5qPastbtQlpoNMNMZ2uo2glYJWoEZOMg90IS1eI7Wm75ypMWlpvSKwKe4EzBYQ8S2FFQRn8IO3Yr9hhOF12U2uPx4hlIb966K+PtdqFqpT7l8VzFMSyl+T8B5vhQQpW78JzE7dzatnmnGM9eyLFrtp399DT960/HHijmzDT3hPg3PxsOcbdye305hX2rqdxEz1z0qSrOkcpJU2YnWWpyZDbmWWVLAWvq4exJJ7O6LHxK65taU+LqRS6SmsXDUklxmXWshDTedoWoJ8pRUrICRjOFdRjBWy7fFJ5a6dAysDG00tn7jLCotq+G+HeLJVMv4RyuXzcflbcnHsyYo2qmiyb51ZtW/TcZp5t9cuoSYkubz+U+XvP3jbnOOw47evZCwY1N4sOUioK0qpa5Z0BSWTJuJWB83n70n5w+iGJqDqnd9ocPMrf9RtuUk7iUtpEzTZlLgQ0VuFOMZCuwA9vfB3dsJ5TWXx4eI8pokeI3R/78FFpVN+6LxJ4vmVv8zwLwjmbk7cY3ox7esX+eoMnULQetmoDwiTmJAyL/TG9Cm9iunXGRmIvSK5pu8tNKDdE9LsS8zUpRL7jTOdiSSegyScdPTC61f1krtma7Wbp/IUumzEhXlSgffeC+a3zppTKtuFAdAMjIPWIJWTfdr9uQ4XJTtPOEpdpX1QrmVqGqfFIm25hMsaPs3hKt2wK5525JPce3sjUEJPir1irmkcjQJii0ynT6qm6+h0TgXhIbCCMbVD849sUmY1g4lZaXVMvaLS6mkDcrly7y1EeoJcJP0AxZKF2oSnJr/SFlR4RqKCFPw8a2UnVunzrIp66RXKdgzcitzeCgnAcQrAyMjBBGUnAPaCYazNYrhrfExXtMJmnUtulU5t5TUw2hznqKAgjcSsp/KPYkRT3E02muhLch4wRmW6NXeIikTFUfTpJJGlyS3liaW27gsoJO84c/NGYr9mcQ2u15U52o2vpfSarKMvFhx1hDxSlYAUUnLnbhQP0xYtJY1nK/wAoW5GuoIQWrOsV+2FoTbt51C2qZJ3HUKiJSdp80hwtsApfUMALBzhtB6k9pi53zqFVLf4ejqPLyUm9URSpSd8HWFcne9y9w6Hdgbzjr3CK+4nx5vA9yGVBGT7Y124grnokvW6BpPTahTpjdyZhlt0oXtUUqx+E7lJI+iGXopfGsdyXa9IX/p5L27Skya3W5ptCwVPBaAlHlLUOoKj2d0SnppwTba48xKSY5YIy9cfEHqFd171G2NErNl6w1TllD0/NAqDmCRuHloQhJIONyiVAZwOwTFv3txQsVylStzaYUEU6YnGmZmZlXAtbTalhKlkImF4ABJztx0hvSzS5aXlnkNyNEwQQRmJBBBBAAj+LJlaqdb8wAdiHn0E+tQQR9kxn+Nk6oWq3eFnzNI3JRMgh6VWrsS6nOM+oglJ9RjH9UkJ2l1B6QqMs7LTTKtrjTicFJ/8A3f3x13Yt8Z0d34xPE7QrcbN3gxlp80eyPXS6fOVOdRJyMut95fYlI7PWT3D1xm3UC8dR6FNFxm4HF055X4NYlGcoP5hIRn2Hvj9ELbp8jIUqXElKMy/MaQpZQgAqOB1J741a/tdaVYUct/cyafsqVvMpLHkddoURqgUNmQQQtzz3lj8tZ7T7OwD1ARLwQRxVlkrJucnyzpIQUIqMeiM88cunlwXtYlKqVtyT1RmqLMuLdlGElTrjTiQFKQkdVEFCeg64J9EQOm/F7bi5Zil3/RJ+i1BgBp6Zlm+awVJ6EqR0Wjr+SArHpjTNTqdNpiG11KoSkkl1exszDyWwtWM4G4jJwD0il6sUvSus2nPTt+N0BdPSypKp54th1rp/huecF9mAk5PQYOcRorti4KuyOV4YBrnKLValx0K6qIzWrdqktU6e95j7C9wz3pI7UqHek4I7xGGeFXV+1NKaref3Tt1JfjR6X8H8DYS5jlKf3bsqGPxicfTDI+DjTPiiXopXN8WGalRL7vN5oS5zMd2dpaz9EQPAr9y/jXUD7pPE/wCOk+R4w5f50zu27/8ATnHqjRGuNStg+UsEc5wx/aRa8WRqhcsxQLbaq6JxiTVOLM3LJbRy0rQg4IWeuXE93phIXo2iu/CG0WnzwDjMjyFNJV1ALcoqYT/59Y07SJuw5SdSaRM20xNO/gk+CuMJWvJHkjb1OTjp6cRlzXCcZsDjdtu8qsSxS5xuXccmCPJQgtqllk/NHlEduMemK9PhzlsWOHgcunJsiEXx0fJ7qP8AnpX+IIc7dXpTkgifbqckuTWNyX0vpLah6QrOCITfGahNa4bqvO0p1udl2n5Z/mMLC0qQHkpJBHQgZ6+jB9EZ9PxbH8olLoWrhj+IGzPdqPrMIvig+WPpV+kpn/sFw1eEe8Leq2h1vyEvVpMT1MlTLzkqp5IdZKFK8pSSchJGCD2dfUYTOslbpl78atgS1szjNTTSn5FuYdllhxG9qZW+4AodDtR247CCO6NNMWr558yL+FEr8I//AGRZX+YnPssxoP762l7UtvXqNaOEIyQmsy6j0HcAvJPqEZ8+Ef8A7Isr/MTn2WYkdWuFixpHTKtVO0JeporknKGalw7NFxLmzClo246lSQoD1kQ1GuVNam8dfcXOXggOD0i4uJfUG86LLraoDqJvlq2FIPPmkraSR3EpQpWO7EezSv5fV4/oZn7LUXrgSuKl1fRYUqUlJWVn6RNrZnQy2EF7d5TbysdpKfJyep5Zii6V/L6vH9DM/ZaicpNzsWOiwC6I0rqn8WN1e5Zz+AuEZ8Hd8Udc9/Ofy7EPPVP4sbq9yzn8BcIz4O74o657+c/l2IzQ+mn+USfxI7PhD/ibo36wtfy8xEvrF8iFX6uU362IiPhD/ibo36wtfy8xEvrF8iFX6uU362Itr+XX/IT6sWvDrxHafWDo/RbUrjNbVUJIzBdMvKoW35b7jicErBPRY7u2NJ6Rak29qhbszXbaRPIlJebVKLE20G17whCzgBR6YWn98KvhH+4T+j/bnjr7m/Dt01zfC+Rzf607jO7r2YxnuxDut2btYFcjb0zRsnLqmJFxr1AqKUfQM+yK9Vs3yxF5yEc4MVWPcV0cLOoVfpdw2pMVChVZ5CUTaco5yGystuNOEFKjtcOUHBB7xjrp3SzXvTfUScbptHqzknVXBlEhUG+S6v1JOShZ9SVE9+IvgqluVZt2TFRpU+gqLbjPObdBOcFJTk9c9MRizivpFlU3We0GdMmqfL3C5MJ8NlqXtDbb/Nb5B2o8lLhO7IGD0SSOuTbHZqpYksS+/wD0XMTdEEEEecWBBBBAARA3ZZ1t3S2lNcpbUytAwh0EocT6gpJBx6uyJ6CJQnKD3ReGKUVJYaFPU+H/AE/qMq7KzKKmph1O1TfhCSP3phqy7SWWG2UZ2tpCRntwBiPuCLLdRbdjvJZwRhXGHwrAQQQRSTKJrLpZbmqtFlKVccxUmGZR4vsrknkoUFlO3ruSoHofRCga4MtP0vJU5c1zLbByUhbAJHozy/8AaNNQRdDUW1rEXwJxTIKw7Rt+x7al7dtmnokqexkhAUVKWo+ctSj1Uo+k+odgAhHTHBzpk/MOPLrt3hTiiogTctjJOf8AkRo6CFC+yDbi+oNJmf7Z4TNObfuSmV6SrV1uTNNnGpxlDs1LlCltrC0hQDIJGUjOCPbDL1c0vtLVCiNUy6JR1SpdRXKzcusIflycZ2KIIwcDIIIOB0yARdYIJX2SkpN8oMIzRKcGenSHd0zcV0PIB81LzCM+08ow9rXsyhW9YcvZMrLKmaKxLKleTNkOcxtWdyV9MHO490WGCCy+yz4nkFFIzhXeDzTaeqTs1T6rcFLZcVuEq0824236klaCrHtJ9sX3RrQmxdLptyo0Vmbnqs4gtmfn3AtxCD2pQEgJSDjtAz3ZxDSghy1Nso7XLgNqQu9bNH7a1alqWxcc9V5RNMW4tkyDraCouBIO7ehefNGMY74YaUgICe0AY6xzBFbm2lF9EPAtNKNFrW0zuisV22ahWkirJKXpF95tUsgb96diUthQ25KU5UeijnPbHfQNH7YourlS1OlJyrLrNRStLzLjzZlwFhIO1IQFDzR2qMMSCJO2bbbfUWEeKv0xitUKoUaaW6iXn5VyWdU2QFhK0lJKSQRnB6ZBiqaM6YUDSm3JuhW9OVOalpqbM2tU+4hawsoSjAKEJGMIHd6esXiCIqclHbngeCk6yaZ0DVS2pagXFNVGXlZacTOIVIuIQsrShaACVoUMYcPd6Osei5dPqLX9LDp1OTM+3STJMSXNZcQH9jWzadxSU58gZ8n09BFughqySSWegsGbv6GmmH/Xbw/7uW/+EXTR3h9szS26nrjt+p1+am3ZRcopE8+ytsIUpCiQENJOcoHf6ekN2CLJam2Sw5cC2ozncXCDp5VapMVBqu3LKuTDqnXUh9ladyjk4y3kdSe0mLNpHw36f6dV9u4JU1Cr1VnJlnqg4kplyQRuQhKUjdg9pzjuxDmggeptlHa5cBtQQQQRQSP/2Q==" style="height:40px;display:block;" alt="Latin Securities"/></div>
<div class="ev"><div class="ev-t">${esc(meta.eventTitle||'LS Conference')}</div><div class="ev-s">${esc(meta.eventType||'LS Conference')} &middot; ${esc(meta.eventDates||'April 14–15, 2026')}</div>${meta.venue?`<div class="ev-s" style="margin-top:2px;font-style:italic">${esc(meta.venue)}</div>`:''}</div></div>
<h1>${esc(name)}</h1><h2>${esc(sub)}</h2>
${sections.map((sec,_si)=>`${_si>0?'<p style="page-break-before:always;margin:0;font-size:1pt">&nbsp;</p>':''}<table>
<tr><td colspan="${sec.headerCols.length}" class="dh">${esc(sec.dayLabel)}</td></tr>
<tr>${sec.headerCols.map(h=>`<th class="th">${esc(h)}</th>`).join("")}</tr>
${sec.rows.map((r,i)=>`<tr class="${i%2===0?"even":""}"><td class="tt">${esc(r.time)||""}</td>
<td><strong>${esc(r.col1)}</strong></td>
<td style="font-size:9pt;color:#555">${esc(r.col2||"")}</td><td>${esc(r.col3||"")}</td><td>${esc(r.col4||"")}</td><td class="tr">${esc(r.col5||"")}</td></tr>`).join("")}
</table>`).join("")}
${(meta.contacts||[]).length?('<div style="margin-top:24px;padding-top:10px;border-top:2px solid #3399ff;font-size:9pt;color:#444"><strong style="color:#1e5ab0">Latin Securities \u2014 Event Contact</strong><br/>'+(meta.contacts||[]).map(c=>'<span>'+esc(c.name)+(c.role?' \u00b7 '+esc(c.role):'')+(c.email?' \u00b7 <a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>':'')+(c.phone?' \u00b7 '+esc(c.phone):'')+' </span>').join('&nbsp;|&nbsp;')+'</div>'):''}
</body></html>`;
}

function buildPrintHTML(entities,meta={}){
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Latin Securities · Schedule</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1a1a1a;background:#fff;padding:20px 28px}
.page{max-width:820px;margin:0 auto}.page+.page{page-break-before:always}
.ls-hdr{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #3399ff;padding-bottom:10px;margin-bottom:16px}
.ls-logo{display:flex;align-items:center;}
h1{font-size:18pt;font-weight:700;color:#1e5ab0;margin:0 0 4px}h2{font-size:10.5pt;color:#666;margin:0 0 16px;border-bottom:1px solid #dde;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
.dh{background:#1e5ab0;color:#fff;font-weight:700;padding:6px 12px;font-size:10.5pt;letter-spacing:.04em}
.th th{background:#3399ff;color:#fff;padding:6px 10px;text-align:left;font-size:9.5pt}
.even td{background:#f3f5fb}td{padding:7px 10px;border-bottom:1px solid #dde;vertical-align:top}
.tt{font-weight:700;color:#1e5ab0;white-space:nowrap;width:72px}.tr{font-style:italic;width:80px}
small{font-size:9pt;color:#666}em{font-size:9pt;color:#555}
.atts{font-size:9.5pt;color:#555;margin-top:8px;padding-top:8px;border-top:1px dashed #dde}
.ev-info{text-align:right}
@media print{.page+.page{page-break-before:always}
  .dh{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .th th{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .even td{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
${entities.flatMap(e=>e.sections.map((sec,_si)=>`<div class="page">
<div class="ls-hdr"><img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABQAPcDASIAAhEBAxEB/8QAHQAAAgMAAwEBAAAAAAAAAAAAAAcFBggBAwQCCf/EAE0QAAECBQIDAggHDAgHAQAAAAECAwAEBQYRBxIIEyExQRQVIjJRYXF1CTc4coGxshYXIzNCUnN2kaGztBg0NTZDdILBJ1NVlKK10/D/xAAaAQACAwEBAAAAAAAAAAAAAAAAAQIDBAYF/8QALhEAAgIBAwEGBQQDAAAAAAAAAAECAxEEEiExBRNBYYGxMjM0UXEiQnLBkaHR/9oADAMBAAIRAxEAPwDZcEEEABBBBAAQR5qnPydNk1zc9MIYYR2qUf3D0n1CKDUtVJVt4op9KcfQP8R13Zn6AD9ca9Nob9T8qOTPdqqqPmSwMeCKpYV2uXO5OIckUS3g4QRtc3bt2fUPRFriq+idE3XYsNFlVsLoKcHwEEUbXHURnS+xHLqfpTlTQiZbY5CHg0Tvz13EHsx6InNPbjRd9kUa525RUoiqSjc0lhS95bChnbnAz7cRDZLbu8CefAnYIIzbePFXK0O7bhokhYNSrDFCmXGJmdYm8IGxewrVhs7U7gRkmHXVO14igbS6mkoIoNA1Ll65oj982m0h99Hi96bFPQ5ucUtoqCmgoDqdyCM4+iExP8XUxIS5mJ7SWuyrIIBcemihIJ7BktYicNPZNtJdAckjUsEZdluLWdmpdExLaQ3A+y4NyHG5gqSoekENYMMfVDWlqx9VbUsRduLnlXCqXSJsTgbDHNfLXmbDuxjPaM9kD01qeGhbkNuCFhxCavS2kNGpdRmaE7VxUJhbAQ3MBrZtTuzkpOY6OH3WmnatorLbNGeos7SnGw7LPPhxSkr3YUPJT2FKgRjp09MR7mezvMcDys4GtBCovrWeWtbWu39M3KA9NPVlDCkzqZkJS1zXFo6o2knGzPaO2GvEZQlFJvxDIQQQRAYQQQQAEEEEABBBBAAQQQQAEEEEABBBBABTNT7/AJOxEU9c3T35zw0uBPKWE7dm3Oc/Ois0XXi1JyZSzPydQpyVHHNWkOIT7dp3fsBiE4tPxFufOmfqahBx0mg7M0+o00ZzXLz4+Z5Op1dldriug+tQ7iNfrizLvb5BjyJfafJUO9f0/ViK1Hy2AEJA7ABH1HU0UxprVcOiOctslbNzl1YytC/6xVvmNfWuGjCu0L/H1b5rX1rhoxw/bf1s/T2R1PZf0sfX3YhOPH4gZj3nLfWqL7w5/ETZXueX+wIoXHj8QMx7zlvrVF94c/iJsr3PL/YEZZfTL8/0bv3FruysMW9a1Wr8zjkU2Sem3Ae9LaCoj90ZU4O7LcuzR3UmpVEByZulbtPDqx1yGlKKx/rfz7UeqGlxs3F4h0BqrCHNj9XfZp7Zz1wpW9f7UNrH0wm9Fb+1nsXTWk29QtFp6oyCEKfbnFMP5mA6ouBfQYxhQA9QEWUVy7huPVv2E3yXn4Pmvrm9Nq3bEwSJijVLeEK6FDbycgY+e27+2LBx2fJ+nPeEr9swnuEqtVah8T9w0Wv0Z6gTNxsPvGmupUgsu7vCEJAV1wGy5j1EQ4eOz5P057wlftmJWRxq4v74Yk/0lz4afiEsv3U1/vCK4qvla6U/pqf/AD5h68NPxCWX7qa/3hFcVXytdKf01P8A58xGj6iXqN/CSHwjP9y7U94u/wAOI6S/4VcXdAqA/A0W+aay073JDziUpP085CFE9wdMSPwjP9y7U94u/wAOJnjDtR2saCUW6JAKTUbZ5E0hxHnpZWlKXMejB5a8+hBiyqS7uEX0llCfVsq2vfy5dOv0Mh/MvRrmMO3DdbV78Tmjl1NFO6oU2mreCexLwmX0upHsWlQ+iNxRRqk4xgn9iUfEIIIIxkgggggAIIIIACCCCAAggggAIIIIACCCCABF8Wn9Xtz50z9TUIOH5xafiLb+dM/U1CDjtOyPpIevuzwNd8+Xp7DUT5o9kcxwnzR7I5j3jwRlaF/j6t81r61w0YWehjKwiqzBB2EtISfSRuJ+sfthmRwXbTzrZ+nsjruzFjSx9fdlC1405++lYDlqeOPFG+Zaf8J8G5+NhPTbvT257cwj5bhHuGWYRLy+tdUZZbTtQ23TXEpSPQAJnAEOjX7VWl6TWamszkqqfnpp3kSMmlezmrxklSsHalI7Tg9oHfChomoXFjXGG6xStMqB4vmUhxhqa2snYRkHDkyhfZ3kD2Rnod6h+lpLzx/ZsljJJV3hhqda0/o1oVHU+amGqfUZiecmHaYVrfLiW0pT5T527QheDk539gx10bKsMysq1Ky7YbZZQG20DsSkDAH7IoWiNw6i3BR6i5qPastbtQlpoNMNMZ2uo2glYJWoEZOMg90IS1eI7Wm75ypMWlpvSKwKe4EzBYQ8S2FFQRn8IO3Yr9hhOF12U2uPx4hlIb966K+PtdqFqpT7l8VzFMSyl+T8B5vhQQpW78JzE7dzatnmnGM9eyLFrtp399DT960/HHijmzDT3hPg3PxsOcbdye305hX2rqdxEz1z0qSrOkcpJU2YnWWpyZDbmWWVLAWvq4exJJ7O6LHxK65taU+LqRS6SmsXDUklxmXWshDTedoWoJ8pRUrICRjOFdRjBWy7fFJ5a6dAysDG00tn7jLCotq+G+HeLJVMv4RyuXzcflbcnHsyYo2qmiyb51ZtW/TcZp5t9cuoSYkubz+U+XvP3jbnOOw47evZCwY1N4sOUioK0qpa5Z0BSWTJuJWB83n70n5w+iGJqDqnd9ocPMrf9RtuUk7iUtpEzTZlLgQ0VuFOMZCuwA9vfB3dsJ5TWXx4eI8pokeI3R/78FFpVN+6LxJ4vmVv8zwLwjmbk7cY3ox7esX+eoMnULQetmoDwiTmJAyL/TG9Cm9iunXGRmIvSK5pu8tNKDdE9LsS8zUpRL7jTOdiSSegyScdPTC61f1krtma7Wbp/IUumzEhXlSgffeC+a3zppTKtuFAdAMjIPWIJWTfdr9uQ4XJTtPOEpdpX1QrmVqGqfFIm25hMsaPs3hKt2wK5525JPce3sjUEJPir1irmkcjQJii0ynT6qm6+h0TgXhIbCCMbVD849sUmY1g4lZaXVMvaLS6mkDcrly7y1EeoJcJP0AxZKF2oSnJr/SFlR4RqKCFPw8a2UnVunzrIp66RXKdgzcitzeCgnAcQrAyMjBBGUnAPaCYazNYrhrfExXtMJmnUtulU5t5TUw2hznqKAgjcSsp/KPYkRT3E02muhLch4wRmW6NXeIikTFUfTpJJGlyS3liaW27gsoJO84c/NGYr9mcQ2u15U52o2vpfSarKMvFhx1hDxSlYAUUnLnbhQP0xYtJY1nK/wAoW5GuoIQWrOsV+2FoTbt51C2qZJ3HUKiJSdp80hwtsApfUMALBzhtB6k9pi53zqFVLf4ejqPLyUm9URSpSd8HWFcne9y9w6Hdgbzjr3CK+4nx5vA9yGVBGT7Y124grnokvW6BpPTahTpjdyZhlt0oXtUUqx+E7lJI+iGXopfGsdyXa9IX/p5L27Skya3W5ptCwVPBaAlHlLUOoKj2d0SnppwTba48xKSY5YIy9cfEHqFd171G2NErNl6w1TllD0/NAqDmCRuHloQhJIONyiVAZwOwTFv3txQsVylStzaYUEU6YnGmZmZlXAtbTalhKlkImF4ABJztx0hvSzS5aXlnkNyNEwQQRmJBBBBAAj+LJlaqdb8wAdiHn0E+tQQR9kxn+Nk6oWq3eFnzNI3JRMgh6VWrsS6nOM+oglJ9RjH9UkJ2l1B6QqMs7LTTKtrjTicFJ/8A3f3x13Yt8Z0d34xPE7QrcbN3gxlp80eyPXS6fOVOdRJyMut95fYlI7PWT3D1xm3UC8dR6FNFxm4HF055X4NYlGcoP5hIRn2Hvj9ELbp8jIUqXElKMy/MaQpZQgAqOB1J741a/tdaVYUct/cyafsqVvMpLHkddoURqgUNmQQQtzz3lj8tZ7T7OwD1ARLwQRxVlkrJucnyzpIQUIqMeiM88cunlwXtYlKqVtyT1RmqLMuLdlGElTrjTiQFKQkdVEFCeg64J9EQOm/F7bi5Zil3/RJ+i1BgBp6Zlm+awVJ6EqR0Wjr+SArHpjTNTqdNpiG11KoSkkl1exszDyWwtWM4G4jJwD0il6sUvSus2nPTt+N0BdPSypKp54th1rp/huecF9mAk5PQYOcRorti4KuyOV4YBrnKLValx0K6qIzWrdqktU6e95j7C9wz3pI7UqHek4I7xGGeFXV+1NKaref3Tt1JfjR6X8H8DYS5jlKf3bsqGPxicfTDI+DjTPiiXopXN8WGalRL7vN5oS5zMd2dpaz9EQPAr9y/jXUD7pPE/wCOk+R4w5f50zu27/8ATnHqjRGuNStg+UsEc5wx/aRa8WRqhcsxQLbaq6JxiTVOLM3LJbRy0rQg4IWeuXE93phIXo2iu/CG0WnzwDjMjyFNJV1ALcoqYT/59Y07SJuw5SdSaRM20xNO/gk+CuMJWvJHkjb1OTjp6cRlzXCcZsDjdtu8qsSxS5xuXccmCPJQgtqllk/NHlEduMemK9PhzlsWOHgcunJsiEXx0fJ7qP8AnpX+IIc7dXpTkgifbqckuTWNyX0vpLah6QrOCITfGahNa4bqvO0p1udl2n5Z/mMLC0qQHkpJBHQgZ6+jB9EZ9PxbH8olLoWrhj+IGzPdqPrMIvig+WPpV+kpn/sFw1eEe8Leq2h1vyEvVpMT1MlTLzkqp5IdZKFK8pSSchJGCD2dfUYTOslbpl78atgS1szjNTTSn5FuYdllhxG9qZW+4AodDtR247CCO6NNMWr558yL+FEr8I//AGRZX+YnPssxoP762l7UtvXqNaOEIyQmsy6j0HcAvJPqEZ8+Ef8A7Isr/MTn2WYkdWuFixpHTKtVO0JeporknKGalw7NFxLmzClo246lSQoD1kQ1GuVNam8dfcXOXggOD0i4uJfUG86LLraoDqJvlq2FIPPmkraSR3EpQpWO7EezSv5fV4/oZn7LUXrgSuKl1fRYUqUlJWVn6RNrZnQy2EF7d5TbysdpKfJyep5Zii6V/L6vH9DM/ZaicpNzsWOiwC6I0rqn8WN1e5Zz+AuEZ8Hd8Udc9/Ofy7EPPVP4sbq9yzn8BcIz4O74o657+c/l2IzQ+mn+USfxI7PhD/ibo36wtfy8xEvrF8iFX6uU362IiPhD/ibo36wtfy8xEvrF8iFX6uU362Itr+XX/IT6sWvDrxHafWDo/RbUrjNbVUJIzBdMvKoW35b7jicErBPRY7u2NJ6Rak29qhbszXbaRPIlJebVKLE20G17whCzgBR6YWn98KvhH+4T+j/bnjr7m/Dt01zfC+Rzf607jO7r2YxnuxDut2btYFcjb0zRsnLqmJFxr1AqKUfQM+yK9Vs3yxF5yEc4MVWPcV0cLOoVfpdw2pMVChVZ5CUTaco5yGystuNOEFKjtcOUHBB7xjrp3SzXvTfUScbptHqzknVXBlEhUG+S6v1JOShZ9SVE9+IvgqluVZt2TFRpU+gqLbjPObdBOcFJTk9c9MRizivpFlU3We0GdMmqfL3C5MJ8NlqXtDbb/Nb5B2o8lLhO7IGD0SSOuTbHZqpYksS+/wD0XMTdEEEEecWBBBBAARA3ZZ1t3S2lNcpbUytAwh0EocT6gpJBx6uyJ6CJQnKD3ReGKUVJYaFPU+H/AE/qMq7KzKKmph1O1TfhCSP3phqy7SWWG2UZ2tpCRntwBiPuCLLdRbdjvJZwRhXGHwrAQQQRSTKJrLpZbmqtFlKVccxUmGZR4vsrknkoUFlO3ruSoHofRCga4MtP0vJU5c1zLbByUhbAJHozy/8AaNNQRdDUW1rEXwJxTIKw7Rt+x7al7dtmnokqexkhAUVKWo+ctSj1Uo+k+odgAhHTHBzpk/MOPLrt3hTiiogTctjJOf8AkRo6CFC+yDbi+oNJmf7Z4TNObfuSmV6SrV1uTNNnGpxlDs1LlCltrC0hQDIJGUjOCPbDL1c0vtLVCiNUy6JR1SpdRXKzcusIflycZ2KIIwcDIIIOB0yARdYIJX2SkpN8oMIzRKcGenSHd0zcV0PIB81LzCM+08ow9rXsyhW9YcvZMrLKmaKxLKleTNkOcxtWdyV9MHO490WGCCy+yz4nkFFIzhXeDzTaeqTs1T6rcFLZcVuEq0824236klaCrHtJ9sX3RrQmxdLptyo0Vmbnqs4gtmfn3AtxCD2pQEgJSDjtAz3ZxDSghy1Nso7XLgNqQu9bNH7a1alqWxcc9V5RNMW4tkyDraCouBIO7ehefNGMY74YaUgICe0AY6xzBFbm2lF9EPAtNKNFrW0zuisV22ahWkirJKXpF95tUsgb96diUthQ25KU5UeijnPbHfQNH7YourlS1OlJyrLrNRStLzLjzZlwFhIO1IQFDzR2qMMSCJO2bbbfUWEeKv0xitUKoUaaW6iXn5VyWdU2QFhK0lJKSQRnB6ZBiqaM6YUDSm3JuhW9OVOalpqbM2tU+4hawsoSjAKEJGMIHd6esXiCIqclHbngeCk6yaZ0DVS2pagXFNVGXlZacTOIVIuIQsrShaACVoUMYcPd6Osei5dPqLX9LDp1OTM+3STJMSXNZcQH9jWzadxSU58gZ8n09BFughqySSWegsGbv6GmmH/Xbw/7uW/+EXTR3h9szS26nrjt+p1+am3ZRcopE8+ytsIUpCiQENJOcoHf6ekN2CLJam2Sw5cC2ozncXCDp5VapMVBqu3LKuTDqnXUh9ladyjk4y3kdSe0mLNpHw36f6dV9u4JU1Cr1VnJlnqg4kplyQRuQhKUjdg9pzjuxDmggeptlHa5cBtQQQQRQSP/2Q==" style="height:40px;display:block;" alt="Latin Securities"/>
<div class="ev-info"><strong style="font-size:13pt;color:#1e5ab0">${esc(meta.eventTitle||'LS Conference')}</strong><br><span style="font-size:9pt;color:#666">${esc(meta.eventType||'LS Conference')} &middot; ${esc(meta.eventDates||'April 14\u201315, 2026')}</span>${meta.venue?('<br><span style="font-size:9pt;color:#666;font-style:italic">'+esc(meta.venue)+'</span>'):''}</div></div>
<h1>${esc(e.name)}</h1><h2>${esc(e.sub)}</h2>
<table>
<tr><td colspan="${sec.headerCols.length}" class="dh">${esc(sec.dayLabel)}</td></tr>
<tr class="th">${sec.headerCols.map(h=>`<th>${esc(h)}</th>`).join("")}</tr>
${sec.rows.map((r,i)=>`<tr class="${i%2===0?"even":""}"><td class="tt">${esc(r.time)||""}</td>
<td><strong>${esc(r.col1)}</strong></td>
<td style="font-size:9.5pt;color:#444">${esc(r.col2||"")}</td><td>${esc(r.col3||"")}</td><td>${esc(r.col4||"")}</td><td class="tr">${esc(r.col5||"")}</td></tr>`).join("")}
</table>${_si===e.sections.length-1&&e.attendees?.length?('<div class="atts"><strong>Company Representatives:</strong> '+e.attendees.map(a=>esc(a.name)+(a.title?' ('+esc(a.title)+')':'')).join(' &bull; ')+'</div>'):""}
${_si===e.sections.length-1&&(meta.contacts||[]).length?('<div style="margin-top:20px;padding:10px 12px;border-top:2px solid #3399ff;font-size:9pt;color:#444"><strong style="color:#1e5ab0">Latin Securities — Event Contact:&nbsp;</strong>'+(meta.contacts||[]).map(c=>esc(c.name)+(c.role?' &middot; '+esc(c.role):'')+(c.email?' &middot; '+esc(c.email):'')+(c.phone?' &middot; '+esc(c.phone):'')).join('&nbsp;&nbsp;|&nbsp;&nbsp;')+'</div>'):""}
</div>`)).join("")}
</body></html>`;
}

function companyToEntity(co,meetings,investors,cfg){
  const _coSlots=makeSlots(cfg?.hours||DEFAULT_CONFIG.hours,cfg);
  const cms=meetings.filter(m=>m.coId===co.id).sort((a,b)=>_coSlots.indexOf(a.slotId)-_coSlots.indexOf(b.slotId));
  const dinners=(cfg?.dinners||[]).filter(d=>(d.companies||[]).includes(co.id));
  if(!cms.length&&!dinners.length) return null;
  const dg={};cms.forEach(m=>{const d=slotDay(m.slotId);if(!dg[d])dg[d]=[];dg[d].push(m);});
  // Build sections per day — meetings + any dinner that day
  const _dayIds=getDayIds(cfg);
  const _dayLong=getDayLong(cfg);
  const allDays=[...new Set([...Object.keys(dg),...dinners.map(d=>d.day)])].filter(d=>_dayIds.includes(d)).sort((a,b)=>_dayIds.indexOf(a)-_dayIds.indexOf(b));
  return{name:`${co.name} (${co.ticker})`,sub:`${co.sector} · ${cms.length} meeting${cms.length!==1?"s":""}${dinners.length?" · "+dinners.length+" dinner event"+(dinners.length>1?"s":""):""}`,attendees:co.attendees||[],
    sections:allDays.map(day=>({dayLabel:_dayLong[day]||day,headerCols:["Time","Investor","Fund","Type","Room"],
      rows:[
        ...(dg[day]||[]).map(m=>{const invs=(m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);
          const isGrp=invs.length>1;
          const mFunds=new Set(invs.map(i=>i.fund||i.id).filter(Boolean));const mType=mFunds.size<=1?'1x1 Meeting':'Group Meeting';
          const col1=isGrp
            ?invs.map(i=>'<strong>'+esc(i.name)+'</strong>'+(i.position?'<br/><small style="color:#666;font-weight:normal">'+esc(i.position)+'</small>':'')).join('<div style="margin-top:5px;padding-top:5px;border-top:1px solid #e8edf5"/>')
            :invs[0]?.name||'';
          const col1b=isGrp?null:(invs[0]?.position||null);
          return{time:hourLabel(slotHour(m.slotId)),col1,col1b,col1c:null,col1html:isGrp,col2:[...new Set(invs.map(i=>i.fund).filter(Boolean))].join(", "),col3:mType,col4:m.room};}),
        ...dinners.filter(d=>d.day===day).map(d=>({
          time:d.time||"Evening",
          col1:d.name||"Event",col1b:d.restaurant||null,col1c:null,col1html:false,
          col2:"",col3:"Event",col4:d.address||""
        }))
      ]}))};
}
function investorToEntity(inv,meetings,companies,cfg,investors){
  const _allSlots=makeSlots(cfg?.hours||DEFAULT_CONFIG.hours,cfg);
  const _dayLongI=getDayLong(cfg);
  const _dayIds=getDayIds(cfg);
  const cms=meetings.filter(m=>(m.invIds||[]).includes(inv.id)).sort((a,b)=>_allSlots.indexOf(a.slotId)-_allSlots.indexOf(b.slotId));
  const invDinners=(cfg?.dinners||[]);
  const dg={};cms.forEach(m=>{const d=slotDay(m.slotId);if(!dg[d])dg[d]=[];dg[d].push(m);});
  const useDays=_dayIds.filter(d=>dg[d]||invDinners.some(din=>din.day===d));
  if(!useDays.length) return null;
  return{name:inv.name,sub:[inv.position,inv.fund].filter(Boolean).join(" · "),
    sections:useDays.map(d=>({dayLabel:_dayLongI[d]||d,headerCols:["Time","Company","Meeting Type","Room"],
      rows:[
        ...(dg[d]||[]).map(m=>{const co=coById.get(m.coId);
          const mInvIds=m.invIds||[];
          const mFunds2=new Set(mInvIds.map(id=>{const inv=invById.get(id);return inv?.fund||id;}).filter(Boolean));const meetingType=mFunds2.size<=1?'1x1 Meeting':'Group Meeting';
          const reps=(co?.attendees||[]).map(a=>esc(a.name)+(a.title?'<br/><small style="color:#888">'+esc(a.title)+'</small>':'')).join('<div style="height:3px"/>');
          return{time:hourLabel(slotHour(m.slotId)),
            col1:co?.name||m.coId,col1b:co?.ticker,
            col1c:reps?('<div style="margin-top:4px;font-size:9pt;color:#555;line-height:1.7">'+reps+'</div>'):null,
            col1html:false,col1chtml:!!reps,
            col2:meetingType,col2html:false,col3:m.room,meetingType};}),
        ...invDinners.filter(din=>din.day===d).map(din=>({time:din.time||"Evening",col1:din.name||"Event",col1b:din.restaurant||null,col1c:null,col1html:false,col2:"Event",col3:din.address||""}))
      ]}))};
}

/* ═══════════════════════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════════════════════ */
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=IBM+Plex+Mono:wght@400;500&family=Lora:wght@400;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{--ink:#f0f3f8;--ink2:#ffffff;--ink3:#e8edf5;--gold:#1e5ab0;--gold2:#3399ff;--cream:#000039;--txt:#2d3f5e;--dim:#7a8fa8;--red:#d94f3a;--grn:#3a8c5c;--blu:#1e5ab0;--pur:#23a29e;--ls-blue:#3399ff;--ls-navy:#000039;--ls-mid:#1e5ab0}
html,body{background:var(--ink)}
.app{min-height:100vh;background:var(--ink);color:var(--txt);font-family:'Lora',Georgia,serif}
.hdr{background:#ffffff;border-bottom:1px solid rgba(30,90,176,.15);padding:0 26px;display:flex;align-items:center;position:sticky;top:0;z-index:300;box-shadow:0 2px 12px rgba(30,90,176,.08)}
.brand{padding:12px 0;margin-right:auto}
.brand h1{font-family:'Playfair Display',serif;font-size:15.5px;color:var(--ls-navy);letter-spacing:.03em}
.brand p{font-size:8.5px;color:var(--dim);letter-spacing:.14em;text-transform:uppercase;margin-top:2px}
.nav{display:flex}
.ntab{padding:0 14px;height:56px;display:flex;align-items:center;font-size:9.5px;letter-spacing:.07em;color:var(--dim);cursor:pointer;border:none;border-bottom:2px solid transparent;background:none;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;transition:all .15s;gap:5px;white-space:nowrap}
.ntab:hover{color:var(--txt)}.ntab.on{color:var(--gold);border-bottom-color:var(--gold);background:rgba(30,90,176,.04)}
.body{padding:24px 26px;max-width:1700px;margin:0 auto}
.pg-h{font-family:'Playfair Display',serif;font-size:21px;color:var(--cream);margin-bottom:3px}
.pg-s{color:var(--dim);font-size:13px;margin-bottom:20px}
.card{background:#ffffff;border:1px solid rgba(30,90,176,.12);border-radius:8px;padding:17px 21px;margin-bottom:13px;box-shadow:0 1px 4px rgba(30,90,176,.06)}
.card-t{font-family:'Playfair Display',serif;font-size:13px;color:var(--gold);margin-bottom:11px;display:flex;align-items:center;gap:7px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:13px}
.inp{background:#f4f7fc;border:1px solid rgba(30,90,176,.18);border-radius:6px;padding:7px 11px;color:var(--txt);font-size:12.5px;width:100%;font-family:'Lora',serif;transition:border-color .15s}
.inp:focus{outline:none;border-color:var(--gold)}
.sel{background:#f4f7fc;border:1px solid rgba(30,90,176,.18);border-radius:6px;padding:7px 11px;color:var(--txt);font-size:12.5px;width:100%;font-family:'Lora',serif;cursor:pointer}
.btn{padding:7px 15px;border-radius:6px;font-size:10.5px;cursor:pointer;font-family:'IBM Plex Mono',monospace;letter-spacing:.04em;transition:all .15s;border:none;display:inline-flex;align-items:center;gap:5px}
.bg{background:var(--gold);color:var(--ink);font-weight:700}.bg:hover{background:var(--gold2)}
.bo{background:transparent;color:var(--gold);border:1px solid rgba(30,90,176,.25)}.bo:hover{border-color:var(--gold);background:rgba(30,90,176,.06)}
.bd{background:rgba(214,68,68,.1);color:var(--red);border:1px solid rgba(214,68,68,.24)}.bd:hover{background:rgba(214,68,68,.2)}
.bs{padding:4px 10px;font-size:10px}
.tbl{width:100%;border-collapse:collapse}
.tbl th{background:rgba(30,90,176,.06);color:var(--gold);font-size:9px;letter-spacing:.08em;text-transform:uppercase;padding:7px 10px;text-align:left;font-family:'IBM Plex Mono',monospace;border-bottom:1px solid rgba(30,90,176,.1)}
.tbl td{padding:7px 10px;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px;vertical-align:middle}
.tbl tr:hover td{background:rgba(30,90,176,.03)}
.bdg{display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-family:'IBM Plex Mono',monospace}
.bg-g{background:rgba(30,90,176,.1);color:var(--gold)}.bg-r{background:rgba(214,68,68,.12);color:var(--red)}.bg-b{background:rgba(74,143,212,.12);color:var(--blu)}.bg-grn{background:rgba(74,175,122,.12);color:var(--grn)}
.stats{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}
.stat{background:#ffffff;border:1px solid rgba(30,90,176,.1);border-radius:7px;padding:11px 15px;flex:1;min-width:90px}
.sv{font-family:'Playfair Display',serif;font-size:26px;color:var(--gold);line-height:1}
.sl{font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.09em;margin-top:3px;font-family:'IBM Plex Mono',monospace}
.upz{border:2px dashed rgba(30,90,176,.15);border-radius:8px;padding:38px 20px;text-align:center;cursor:pointer;transition:all .2s}
.upz:hover{border-color:var(--gold);background:rgba(30,90,176,.03)}
.alert{padding:9px 12px;border-radius:6px;font-size:12px;margin-bottom:10px}
.aw{background:rgba(214,68,68,.07);border:1px solid rgba(214,68,68,.2);color:#e8a0a0}
.ai{background:rgba(74,143,212,.07);border:1px solid rgba(74,143,212,.2);color:#a0c4e8}
.ag{background:rgba(74,175,122,.07);border:1px solid rgba(74,175,122,.2);color:#96d4b4}
.tag{display:inline-flex;padding:2px 6px;border-radius:12px;font-size:10px;background:rgba(30,90,176,.07);color:var(--gold2);border:1px solid rgba(30,90,176,.1);margin:2px 2px 0 0}
.flex{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.lbl{font-size:9px;color:var(--dim);text-transform:uppercase;letter-spacing:.08em;font-family:'IBM Plex Mono',monospace;margin-bottom:3px}
.ent-row{background:#ffffff;border:1px solid rgba(30,90,176,.1);border-radius:7px;padding:11px 14px;margin-bottom:5px;display:flex;align-items:flex-start;gap:10px;cursor:pointer;transition:all .15s}
.ent-row:hover{border-color:rgba(30,90,176,.28);background:#f0f5ff}
.slot-cell{padding:3px 2px;text-align:center;border-radius:3px;cursor:pointer;font-size:9px;font-family:'IBM Plex Mono',monospace;transition:all .12s;user-select:none}
.slot-avail{background:rgba(74,175,122,.13);color:var(--grn);border:1px solid rgba(74,175,122,.2)}
.slot-avail:hover{background:rgba(74,175,122,.22)}
.slot-blocked{background:rgba(214,68,68,.13);color:var(--red);border:1px solid rgba(214,68,68,.2);text-decoration:line-through}
.slot-blocked:hover{background:rgba(214,68,68,.22)}
.slot-na{background:rgba(255,255,255,.03);color:rgba(255,255,255,.12);border:1px solid transparent;cursor:default}
.grid-wrap{overflow-x:auto}
.grid-tbl{border-collapse:collapse;table-layout:fixed}
.grid-tbl .th-time{width:72px;background:rgba(30,90,176,.07);font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--gold);padding:7px 8px;border-bottom:1px solid rgba(30,90,176,.1);text-align:right;text-transform:uppercase;position:sticky;left:0;z-index:10}
.grid-tbl .th-sect{font-size:7.5px;letter-spacing:.08em;text-transform:uppercase;padding:3px 6px;text-align:center}
.grid-tbl .th-co{background:var(--ink2);font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--txt);padding:5px 7px;border-bottom:2px solid;text-align:center;min-width:110px;white-space:nowrap}
.grid-tbl .td-time{background:rgba(30,90,176,.06);font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--gold);padding:4px 8px;border-right:2px solid rgba(30,90,176,.12);border-bottom:1px solid rgba(255,255,255,.04);text-align:right;white-space:nowrap;font-weight:600;position:sticky;left:0;z-index:9;vertical-align:middle}
.grid-tbl .td-c{padding:3px 4px;border-bottom:1px solid rgba(255,255,255,.04);border-right:1px solid rgba(255,255,255,.04);vertical-align:top;min-height:50px;cursor:pointer;transition:background .1s}
.grid-tbl .td-c:hover{background:rgba(30,90,176,.07)}
.m-pill{border-radius:4px;padding:4px 5px;min-height:44px;display:flex;flex-direction:column;justify-content:flex-start;border-left:2px solid;overflow:hidden}
.mp-n{font-size:10px;color:var(--cream);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}
.mp-f{font-size:8.5px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mp-r{font-size:8px;font-family:'IBM Plex Mono',monospace;color:var(--gold);margin-top:1px}
.add-ic{color:rgba(255,255,255,.09);font-size:13px;text-align:center;line-height:50px;width:100%;display:block}
.overlay{position:fixed;inset:0;background:rgba(10,20,60,.45);z-index:500;display:flex;align-items:flex-start;justify-content:center;padding:30px 16px;backdrop-filter:blur(5px);overflow-y:auto}
.modal{background:#ffffff;border:1px solid rgba(30,90,176,.15);border-radius:10px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.6)}
.modal-hdr{padding:22px 24px 16px;border-bottom:1px solid rgba(30,90,176,.1)}
.modal-title{font-family:'Playfair Display',serif;font-size:18px;color:var(--gold)}
.modal-sub{font-size:12px;color:var(--dim);margin-top:3px}
.modal-body{padding:20px 24px}
.modal-footer{padding:14px 24px 20px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid rgba(255,255,255,.05)}
.modal-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.07);margin-bottom:18px}
.mtab{padding:8px 16px;font-size:10px;cursor:pointer;color:var(--dim);border:none;background:none;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid transparent;transition:all .15s}
.mtab.on{color:var(--gold);border-bottom-color:var(--gold)}
.ex-card{background:var(--ink3);border:1px solid rgba(30,90,176,.1);border-radius:8px;padding:16px 18px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;gap:8px}
.ex-card:hover{border-color:rgba(30,90,176,.28);background:rgba(30,90,176,.04)}
.ex-card-ico{font-size:26px}.ex-card-t{font-family:'Playfair Display',serif;font-size:13px;color:var(--cream)}
.ex-card-s{font-size:11px;color:var(--dim);line-height:1.6}
.day-btn{padding:6px 14px;border-radius:6px;font-size:10px;cursor:pointer;font-family:'IBM Plex Mono',monospace;letter-spacing:.05em;text-transform:uppercase;transition:all .15s;border:1px solid}
.doff{background:transparent;color:var(--dim);border-color:rgba(255,255,255,.07)}.doff:hover{color:var(--txt)}
.d14on{background:rgba(74,143,212,.13);color:var(--blu);border-color:rgba(74,143,212,.28)}
.d15on{background:rgba(74,175,122,.13);color:var(--grn);border-color:rgba(74,175,122,.28)}
.fund-group{background:var(--ink3);border:1px solid rgba(30,90,176,.1);border-radius:7px;padding:10px 14px;margin-bottom:6px;display:flex;align-items:center;gap:10px}
.toggle{position:relative;display:inline-block;width:38px;height:20px;flex-shrink:0}
.toggle input{opacity:0;width:0;height:0;position:absolute}
.toggle-track{position:absolute;inset:0;border-radius:20px;background:rgba(255,255,255,.1);transition:.2s;cursor:pointer}
.toggle input:checked+.toggle-track{background:var(--gold)}
.toggle-thumb{position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;top:2px;left:2px;transition:.2s;pointer-events:none}
.toggle input:checked~.toggle-thumb{left:20px}
.attendee-row{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.srch{position:relative}
.srch-ic{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--dim);pointer-events:none;font-size:12px}
.srch .inp{padding-left:28px}
.dbar{height:2px;border-radius:2px;margin-top:3px;background:rgba(255,255,255,.05)}
.dfill{height:2px;border-radius:2px}
.sec-hdr{font-family:'IBM Plex Mono',monospace;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);padding:10px 0 5px;border-bottom:1px solid rgba(255,255,255,.05);margin-bottom:6px}
/* events list */
.ev-card{background:var(--ink2);border:1px solid rgba(30,90,176,.1);border-radius:8px;padding:14px 18px;display:flex;align-items:center;gap:12px;transition:border-color .15s}
.ev-card:hover{border-color:rgba(30,90,176,.22)}.ev-card.active-ev{border-color:var(--gold);background:rgba(30,90,176,.05)}
`;

/* ═══════════════════════════════════════════════════════════════════
   INVESTOR PROFILE MODAL
═══════════════════════════════════════════════════════════════════ */

/* ─── Mini Date Picker ───────────────────────────────────────────── */
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const WDAYS=["Su","Mo","Tu","We","Th","Fr","Sa"];
function DatePicker({value,onChange,onClose}){
  // Handle both YYYY-MM and full YYYY-MM-DD dates
  const parsed=value?new Date((value.length===7?value+"-01":value)+"T12:00:00"):new Date(2026,3,1);
  const [view,setView]=useState({y:parsed.getFullYear(),m:parsed.getMonth()});
  const today=new Date();
  const firstDay=new Date(view.y,view.m,1).getDay();
  const daysInMonth=new Date(view.y,view.m+1,0).getDate();
  const selDate=value?new Date(value+"T12:00:00"):null;
  const cells=[];
  for(let i=0;i<firstDay;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);
  const pad=n=>String(n).padStart(2,"0");
  const isoStr=(d)=>`${view.y}-${pad(view.m+1)}-${pad(d)}`;
  const isSelected=(d)=>selDate&&selDate.getFullYear()===view.y&&selDate.getMonth()===view.m&&selDate.getDate()===d;
  return(
    <div style={{position:"absolute",zIndex:999,background:"#fff",border:"1px solid rgba(30,90,176,.2)",borderRadius:10,boxShadow:"0 8px 32px rgba(30,90,176,.15)",padding:14,minWidth:240,top:"100%",left:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#1e5ab0",padding:"2px 6px"}} onClick={()=>setView(v=>v.m===0?{y:v.y-1,m:11}:{...v,m:v.m-1})} aria-label="Mes anterior">‹</button>
        <span style={{fontFamily:"Lora,serif",fontWeight:700,fontSize:13,color:"#000039"}}>{MONTHS[view.m]} {view.y}</span>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#1e5ab0",padding:"2px 6px"}} onClick={()=>setView(v=>v.m===11?{y:v.y+1,m:0}:{...v,m:v.m+1})} aria-label="Mes siguiente">›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {WDAYS.map(w=><div key={w} style={{textAlign:"center",fontSize:9,color:"#9aabbf",fontFamily:"IBM Plex Mono,monospace",padding:"2px 0"}}>{w}</div>)}
        {cells.map((d,i)=>d===null
          ?<div key={"e"+i}/>
          :<div key={d} role="button" tabIndex={0} aria-label={`${d} ${MONTHS[view.m]} ${view.y}`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){onChange(isoStr(d));onClose();}}} onClick={()=>{onChange(isoStr(d));onClose();}}
              style={{textAlign:"center",fontSize:11.5,padding:"5px 2px",borderRadius:5,cursor:"pointer",fontWeight:isSelected(d)?700:400,
                background:isSelected(d)?"#1e5ab0":"transparent",color:isSelected(d)?"#fff":"#2d3f5e",
                border:d===today.getDate()&&view.m===today.getMonth()&&view.y===today.getFullYear()?"1px solid #3399ff":"1px solid transparent"}}
            >{d}</div>
        )}
      </div>
      <button style={{width:"100%",padding:"5px",background:"none",border:"1px solid rgba(30,90,176,.15)",borderRadius:5,cursor:"pointer",fontSize:10,color:"#7a8fa8",fontFamily:"IBM Plex Mono,monospace"}} onClick={onClose}>Cerrar</button>
    </div>
  );
}

/* ─── Day Date Input (date picker + auto-label generator) ────────── */
function DayDateInput({day,di,onChange}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    if(!open) return;
    const handler=(e)=>{if(ref.current&&!ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[open]);
  function applyDate(isoStr){
    const d=new Date(isoStr+"T12:00:00");
    const shortLabel=d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
    const longLabel=d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
    // ordinal suffix
    const ord=["th","st","nd","rd"];
    const dayNum=d.getDate();
    const v=dayNum%100;
    const suffix=ord[(v-20)%10]||ord[v]||ord[0];
    const longOrd=d.toLocaleDateString("en-US",{weekday:"long",month:"long",year:"numeric"}).replace(/(\d+)/,dayNum+suffix);
    onChange({...day,date:isoStr,short:shortLabel,long:d.toLocaleDateString("en-US",{weekday:"long"})+" "+d.toLocaleDateString("en-US",{month:"long",day:"numeric"})+"th "+d.getFullYear()});
    setOpen(false);
  }
  const displayLabel=day.date?new Date(day.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):day.short||"Pick a date";
  return(
    <div style={{position:"relative"}} ref={ref}>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#1e5ab0",padding:"0 2px",lineHeight:1}}
          aria-label="Día anterior" onClick={()=>{if(day.date){const d=new Date(day.date+"T12:00:00");d.setDate(d.getDate()-1);applyDate(d.toISOString().slice(0,10));}}}>‹</button>
        <button className="inp" style={{flex:1,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px"}}
          onClick={()=>setOpen(o=>!o)}>
          <span style={{fontSize:12,color:"#2d3f5e"}}>{displayLabel}</span>
          <span style={{fontSize:10,color:"#9aabbf"}}>📅</span>
        </button>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#1e5ab0",padding:"0 2px",lineHeight:1}}
          aria-label="Día siguiente" onClick={()=>{if(day.date){const d=new Date(day.date+"T12:00:00");d.setDate(d.getDate()+1);applyDate(d.toISOString().slice(0,10));}}}>›</button>
      </div>
      {open&&<DatePicker value={day.date} onChange={applyDate} onClose={()=>setOpen(false)}/>}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════
   ROADSHOW SCHEDULER
═══════════════════════════════════════════════════════════════════ */
// Hours in 30-min increments: 8.0, 8.5, 9.0, ... 20.0
const ROADSHOW_HOURS=Array.from({length:25},(_,i)=>8+i*0.5);
function fmtHour(h){const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");}
const RS_CLR={"Financials":"#1e5ab0","Energy":"#e8850a","TMT":"#7b35b0","Infra":"#3a6b3a","Real Estate":"#b03535","Agro":"#3a8c5c","Consumer":"#2a7a8a","Exchange":"#374551","Industry":"#5a5a2e","Media":"#a05000","LS Internal":"#23a29e","Custom":"#666"};
const LS_INT_TYPES=["Research – Equities","Research – Fixed Income","Corporate Finance","Economics & Strategy","Political Analyst","Breakfast / Networking Lunch","Airport Transfer","Internal LS Meeting","Dinner","Free time"];
const RS_TRIP_DEF={clientName:"",fund:"",hotel:"Holiday Inn",arrivalDate:"2026-04-18",departureDate:"2026-04-24",lsContactIdx:0,notes:"",officeAddress:"Arenales 707, 6° Piso, CABA",meetingDuration:60,visitors:[],lsTeam:[],mapsApiKey:""};
const RS_COS_DEF=[
  {id:"rc_bmacro", name:"Banco Macro",                  ticker:"BMA",   sector:"Financials",  location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_bbva",   name:"BBVA Argentina",                ticker:"BBAR",  sector:"Financials",  location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_ggal",   name:"Grupo Financiero Galicia",      ticker:"GGAL",  sector:"Financials",  location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_supv",   name:"Grupo Supervielle",             ticker:"SUPV",  sector:"Financials",  location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_byma",   name:"BYMA",                          ticker:"BYMA",  sector:"Exchange",    location:"hq",       contact:{name:"",email:"",phone:""},notes:"",active:true},
  {id:"rc_pampa",  name:"Pampa Energía",                 ticker:"PAMP",  sector:"Energy",      location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_ypf",    name:"YPF",                           ticker:"YPFD",  sector:"Energy",      location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_vista",  name:"Vista Energy",                  ticker:"VIST",  sector:"Energy",      location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_cepu",   name:"Central Puerto",                ticker:"CEPU",  sector:"Energy",      location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_tgsu",   name:"Transportadora de Gas del Sur", ticker:"TGSU2", sector:"Energy",      location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_tgn",    name:"TGN",                           ticker:"TGNO4", sector:"Energy",      location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_teco",   name:"Telecom Argentina",             ticker:"TECO2", sector:"TMT",         location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_cvh",    name:"Corporación América",           ticker:"CAAP",  sector:"Infra",       location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_irsa",   name:"IRSA · Cresud",                 ticker:"IRSA",  sector:"Real Estate", location:"hq",       contact:{name:"",email:"",phone:""},notes:"",active:true},
  {id:"rc_loma",   name:"Loma Negra",                    ticker:"LOMA",  sector:"Industry",    location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_arcos",  name:"Arcos Dorados",                 ticker:"ARCO",  sector:"Consumer",    location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_adeco",  name:"Adecoagro",                     ticker:"AGRO",  sector:"Agro",        location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_a3",     name:"A3",                            ticker:"A3",    sector:"Media",       location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_edn",    name:"Edenor",                        ticker:"EDN",   sector:"Energy",      location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
  {id:"rc_glob",   name:"Globant",                       ticker:"GLOB",  sector:"TMT",         location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true},
];
function genRSEmail(co,trip,meetings,lsContact,tripDays){
  const busy=new Set((meetings||[]).map(m=>`${m.date}-${m.hour}`));
  const workDays=(tripDays||[]).filter(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;});
  const free=[];
  for(const day of workDays){for(const h of[9,10,11,12,14,15,16,17]){if(!busy.has(`${day}-${h}`))free.push({day,h});}}
  const fmtD=iso=>{const s=new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});return s.charAt(0).toUpperCase()+s.slice(1);};
  const arr=fmtD(trip.arrivalDate||"2026-04-18");
  const dep=fmtD(trip.departureDate||"2026-04-24");
  const visitors=(trip.visitors||[]).filter(v=>v.name);
  const visNames=visitors.length>0?visitors.map(v=>v.name+(v.title?` (${v.title})`:"")):[(trip.clientName||"el cliente")];
  const cli=trip.fund?(trip.clientName?`${trip.fund} (${trip.clientName})`:`${trip.fund}`):(trip.clientName||"[cliente]");
  const visitorLine=visitors.length>1?`los siguientes representantes de ${cli}: ${visNames.join(", ")}`:`${visNames[0]} de ${cli}`;
  const loc=co.location==="ls_office"?`en nuestras oficinas (${trip.officeAddress||"Arenales 707, 6° Piso, CABA"})`:co.location==="hq"?`en la sede de ${co.name}`:`en ${co.locationCustom||"un lugar a coordinar"}`;
  const fmtHe=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
  const slots=free.slice(0,6).map(({day,h})=>`• ${fmtD(day)} a las ${fmtHe(h)} hs`).join("\n")||"• A coordinar según disponibilidad";
  const subj=`Solicitud de reunión – ${co.name} / ${trip.fund||trip.clientName||"[cliente]"} | Latin Securities`;
  const primaryContact=(co.contacts||[])[0];
  const body=`Estimado/a ${primaryContact?.name||co.contact?.name||"[Nombre del contacto]"},\n\nMe comunico desde Latin Securities para coordinar una reunión entre el equipo de ${co.name} y ${visitorLine||cli}, quienes estarán visitando Buenos Aires entre el ${arr} y el ${dep}, hospedándose en el ${trip.hotel||"[hotel]"}.\n\nNos gustaría solicitar una reunión de aproximadamente ${trip.meetingDuration||60} minutos. La misma podría realizarse ${loc}, según la conveniencia del equipo.\n\nLes proponemos los siguientes horarios disponibles:\n${slots}\n\nEn caso de preferir otro horario, quedamos totalmente disponibles para ajustar la agenda.\n\nMuchas gracias y saludos cordiales,\n\n${lsContact?.name||"[Nombre LS]"}\n${lsContact?.role||"Institutional Sales"}\nLatin Securities${lsContact?.email?"\n"+lsContact.email:""}${lsContact?.phone?" · "+lsContact.phone:""}`;
  return{to:primaryContact?.email||co.contact?.email||"",subject:subj,body};
}
function rsToEntity(rs,rsCos){
  const{trip,meetings}=rs;
  const rm=new Map((rsCos||[]).map(c=>[c.id,c]));
  const byDay={};(meetings||[]).forEach(m=>{if(!byDay[m.date])byDay[m.date]=[];byDay[m.date].push(m);});
  Object.values(byDay).forEach(arr=>arr.sort((a,b)=>a.hour-b.hour));
  const days=Object.keys(byDay).sort();
  if(!days.length) return null;
  const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
  const fmtLong=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const fmtShort=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
  const visitors=(trip.visitors||[]).filter(v=>v.name);
  const visLine=visitors.length?visitors.map(v=>[v.name,v.title].filter(Boolean).join(" · ")).join(" | "):(trip.clientName||"");
  const sub=`${trip.fund||"Buenos Aires Roadshow"} · ${fmtShort(trip.arrivalDate||"2026-04-18")} – ${fmtShort(trip.departureDate||"2026-04-24")}${visLine?" · "+visLine:""}`;
  return{name:`${trip.clientName||"[Client]"}${trip.fund?" — "+trip.fund:""}`,sub,sections:days.map(date=>({dayLabel:fmtLong(date),headerCols:["Time","Company / Meeting","Representatives","Type","Location","Status"],
    rows:byDay[date].map(m=>{const co=m.type==="company"?rm.get(m.companyId):null;
      const locL=m.location==="ls_office"?(trip.officeAddress||"Arenales 707, 6° Piso, CABA"):m.location==="hq"?(co?co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
      const st=m.status==="confirmed"?"✓ Confirmed":m.status==="cancelled"?"✗ Cancelled":"Tentative";
      // Reps: company contacts (selected) or free-text participants — sorted by last name
      const reps=(()=>{
        if(m.type==="company"){
          const allR=rm.get(m.companyId)?.contacts||[];
          const sel=m.attendeeIds?.length?allR.filter(r=>m.attendeeIds.includes(r.id)):allR;
          const sorted=[...sel.filter(r=>r.name)].sort((a,b)=>{
            const la=a.name.split(" ").pop()||""; const lb=b.name.split(" ").pop()||"";
            return la.localeCompare(lb,"es");
          });
          return sorted.map(r=>r.name+(r.title?" ("+r.title+")":"")).join(", ");
        }
        // Free-text: split by comma, trim, sort by last word, rejoin
        const parts=(m.participants||"").split(",").map(s=>s.trim()).filter(Boolean);
        const sorted=[...parts].sort((a,b)=>{
          const la=a.split(" ").pop()||""; const lb=b.split(" ").pop()||"";
          return la.localeCompare(lb,"es");
        });
        return sorted.join(", ");
      })();
      const fmt=m.meetingFormat||"Meeting";
        const col1Name=co?(co.name+(co.ticker?" ("+co.ticker+")":"")):(m.lsType||m.title||"Meeting");
      return{time:fmtH(m.hour),col1:col1Name,col1b:null,col1c:null,col1html:false,col1chtml:false,
        col2:reps||"",col2html:false,col3:fmt,col3html:false,col4:locL,col5:st};})
  }))};
}


/* ─── Roadshow Agenda Email Modal ───────────────────────────────── */
function RoadshowAgendaEmailModal({roadshow, rsCos, tripDays, lsContact, onClose}){
  const[copied,setCopied]=useState(false);
  const[fmt,setFmt]=useState("text"); // "text" | "html"
  const rm=new Map((rsCos||[]).map(c=>[c.id,c]));
  const{trip,meetings}=roadshow;
  const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
  const fmtDay=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const fmtShort=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
  const byDay={};(meetings||[]).filter(m=>m.status!=="cancelled").forEach(m=>{if(!byDay[m.date])byDay[m.date]=[];byDay[m.date].push(m);});
  Object.values(byDay).forEach(arr=>arr.sort((a,b)=>a.hour-b.hour));
  const days=Object.keys(byDay).sort();
  const fund=trip.fund||(trip.clientName?"":"")||"";
  const client=trip.clientName||fund||"[Client]";
  const visitors=(trip.visitors||[]).filter(v=>v.name);
  const firstNames=visitors.map(v=>v.name.split(" ")[0]);
  const greeting=firstNames.length>0?`Dear ${firstNames.join(" and ")},`:"Dear [Name],";

  // Build plain text agenda
  const textLines=[greeting,"",
    `Please find below your confirmed meeting schedule for your Buenos Aires visit, ${new Date((trip.arrivalDate||"2026-04-18")+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric"})}–${fmtShort(trip.departureDate||"2026-04-24")}.`,""
  ];
  days.forEach(date=>{
    textLines.push(`── ${fmtDay(date).toUpperCase()} ──`,"");
    byDay[date].forEach(m=>{
      const co=m.type==="company"?rm.get(m.companyId):null;
      const locL=m.location==="ls_office"?`LS Offices (${trip.officeAddress||"Arenales 707, 6° Piso, CABA"})`:m.location==="hq"?(co?co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
      textLines.push(`  ${fmtH(m.hour)}   ${co?co.name:(m.lsType||m.title||"Meeting")}${co?" ("+co.ticker+")":""}`);
      textLines.push(`         📍 ${locL}`);
      if(m.notes) textLines.push(`         📝 ${m.notes}`);
      textLines.push("");
    });
  });
  textLines.push("","Should you need to make any changes, please don't hesitate to reach out.","",
    `Best regards,`,"",lsContact?.name||"[LS Contact]",lsContact?.role||"Institutional Sales","Latin Securities",
    lsContact?.email||"",lsContact?.phone||""
  );
  const textBody=textLines.filter(l=>l!==undefined).join("\n");

  // HTML version
  const htmlRows=days.map(date=>{
    const dayRows=byDay[date].map(m=>{
      const co=m.type==="company"?rm.get(m.companyId):null;
      const locL=m.location==="ls_office"?`LS Offices`:m.location==="hq"?(co?co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
      const reps=(()=>{const allR=co?.contacts||[];const sel=m.attendeeIds?.length?allR.filter(r=>m.attendeeIds.includes(r.id)):allR;return sel.filter(r=>r.name);})();
      return `<tr style="border-bottom:1px solid #eef2f8"><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1e5ab0;white-space:nowrap">${fmtH(m.hour)}</td><td style="padding:8px 12px"><strong style="color:#000039">${co?co.name:(m.lsType||m.title||"Meeting")}</strong>${co?` <span style="background:#3399ff;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;font-family:monospace">${co.ticker}</span>`:""}<br/><span style="font-size:11px;color:#7a8fa8">📍 ${locL}</span>${reps.length?`<br/><span style="font-size:11px;color:#555">👤 ${reps.map(r=>r.name+(r.title?` (${r.title})`:"")).join(", ")}</span>`:""}${m.notes?`<br/><span style="font-size:11px;color:#555;font-style:italic">📝 ${m.notes}</span>`:""}</td></tr>`;
    }).join("");
    return `<tr><td colspan="2" style="padding:10px 12px;background:#000039;color:#fff;font-weight:700;font-size:13px;letter-spacing:.04em">${fmtDay(date)}</td></tr>${dayRows}`;
  }).join("");

  const htmlBody=`<div style="font-family:Calibri,Arial,sans-serif;max-width:600px;color:#1a2a3a">
<p style="margin-bottom:12px">${greeting}</p>
<p style="margin-bottom:16px">Please find below your confirmed meeting schedule for your Buenos Aires visit, <strong>${fmtShort(trip.arrivalDate||"2026-04-18")}–${fmtShort(trip.departureDate||"2026-04-24")}</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #dde">${htmlRows}</table>
<p style="margin-bottom:4px">Should you need to make any changes, please don't hesitate to reach out.</p>
<p style="margin-top:20px">Best regards,<br/><strong>${lsContact?.name||"[LS Contact]"}</strong><br/>${lsContact?.role||"Institutional Sales"}<br/>Latin Securities${lsContact?.email?`<br/>${lsContact.email}`:""}</p>
</div>`;

  const toAddrs=visitors.filter(v=>v.email).map(v=>v.email).join(", ");
  const subject=`Buenos Aires Meeting Schedule — ${fund||client} | ${fmtShort(trip.arrivalDate||"")}–${fmtShort(trip.departureDate||"")}`;

  function copyText(){navigator.clipboard.writeText(textBody).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}).catch(()=>{const w=window.open("","_blank","width=680,height=560");w.document.write("<pre style='font:13px monospace;padding:20px;white-space:pre-wrap'>"+textBody+"</pre>");w.document.close();});}
  function openMail(){window.location.href=`mailto:${encodeURIComponent(toAddrs)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody)}`;}

  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:680,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div className="modal-hdr"><div className="modal-title">📧 Agenda para el inversor</div></div>
        <div className="modal-body" style={{flex:1,overflowY:"auto"}}>
          {/* Header info */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200}}>
              <div className="lbl">Para</div>
              <div style={{fontSize:12,color:toAddrs?"var(--txt)":"var(--red)",background:"var(--ink3)",padding:"5px 10px",borderRadius:5,fontFamily:"IBM Plex Mono,monospace"}}>
                {toAddrs||"⚠ Agregá emails en 🧳 Datos del Viaje → Visitantes"}
              </div>
            </div>
            <div style={{flex:2,minWidth:220}}>
              <div className="lbl">Asunto</div>
              <div style={{fontSize:12,color:"var(--cream)",background:"var(--ink3)",padding:"5px 10px",borderRadius:5,fontWeight:600}}>{subject}</div>
            </div>
          </div>
          {/* Format toggle */}
          <div style={{display:"flex",gap:5,marginBottom:10}}>
            {[["text","📄 Texto plano"],["html","🌐 Vista HTML"]].map(([v,l])=>(
              <button key={v} className={`btn bs ${fmt===v?"bg":"bo"}`} style={{fontSize:10}} onClick={()=>setFmt(v)}>{l}</button>
            ))}
          </div>
          {/* Preview */}
          {fmt==="text"&&(
            <pre style={{fontFamily:"Calibri,Georgia,serif",fontSize:12,color:"var(--txt)",background:"var(--ink3)",padding:"12px 14px",borderRadius:6,whiteSpace:"pre-wrap",maxHeight:360,overflowY:"auto",lineHeight:1.75}}>{textBody}</pre>
          )}
          {fmt==="html"&&(
            <div style={{background:"#fff",padding:"16px",borderRadius:6,border:"1px solid rgba(30,90,176,.12)",maxHeight:360,overflowY:"auto"}} dangerouslySetInnerHTML={{__html:htmlBody}}/>
          )}
          {days.length===0&&<div style={{fontSize:12,color:"var(--red)",marginTop:8}}>⚠ No hay reuniones cargadas. Agregá reuniones en la tab 📅 Agenda primero.</div>}
        </div>
        <div className="modal-footer" style={{gap:7}}>
          <button className="btn bo bs" onClick={onClose}>Cerrar</button>
          <button className="btn bo bs" onClick={openMail} disabled={!toAddrs}>📧 Abrir en Mail</button>
          <button className={`btn bs ${copied?"bo":"bg"}`} onClick={copyText}>{copied?"✅ ¡Copiado!":"📋 Copiar texto"}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── ICS Calendar Export ─────────────────────────────────────── */
function buildICS(meetings, companies, trip){
  const rsCoMap=new Map((companies||[]).map(c=>[c.id,c]));
  const pad=n=>String(n).padStart(2,"0");
  const fmtDT=(dateStr,hour)=>{
    const d=new Date(dateStr+"T"+pad(hour)+":00:00");
    return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+"T"+pad(d.getUTCHours())+pad(d.getUTCMinutes())+"00Z";
  };
  const esc=s=>(s||"").replace(/[\,;]/g,"\\$&").replace(/\n/g,"\\n");
  const dur=trip.meetingDuration||60;
  const events=meetings.filter(m=>m.status!=="cancelled").map(m=>{
    const co=m.type==="company"?rsCoMap.get(m.companyId):null;
    const title=co?`${co.name} / ${trip.fund||trip.clientName||"Roadshow"}`:(m.lsType||m.title||"Internal Meeting");
    const locL=m.location==="ls_office"?(trip.officeAddress||"LS Offices"):m.location==="hq"?(co?co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
    const start=fmtDT(m.date,m.hour);
    const endHour=m.hour+Math.floor(dur/60);const endMin=dur%60;
    const d=new Date(m.date+"T"+pad(m.hour)+":00:00");
    const endD=new Date(d.getTime()+dur*60000);
    const endDT=endD.getUTCFullYear()+pad(endD.getUTCMonth()+1)+pad(endD.getUTCDate())+"T"+pad(endD.getUTCHours())+pad(endD.getUTCMinutes())+"00Z";
    const uid=`rs-${m.id}@latinsecurities.ar`;
    const attendees=(trip.visitors||[]).filter(v=>v.email).map(v=>`ATTENDEE;CN="${esc(v.name)}":mailto:${v.email}`).join("\r\n");
    // Use meeting-specific selected reps, fall back to all contacts
    const allCoContacts=co?.contacts||[];
    const selIds=m.attendeeIds||[];
    const mtgReps=selIds.length>0?allCoContacts.filter(r=>selIds.includes(r.id)):allCoContacts;
    const coContactLines=mtgReps.filter(r=>r.email).map(r=>`ATTENDEE;CN="${esc(r.name)}":mailto:${r.email}`).join("\r\n");
    const coContact=coContactLines||( co?.contact?.email?`ATTENDEE;CN="${esc(co.contact?.name||co.name)}":mailto:${co.contact.email}`:"");
    return `BEGIN:VEVENT\r\nUID:${uid}\r\nDTSTAMP:${fmtDT(new Date().toISOString().slice(0,10),new Date().getUTCHours())}\r\nDTSTART:${start}\r\nDTEND:${endDT}\r\nSUMMARY:${esc(title)}\r\nLOCATION:${esc(locL)}\r\nDESCRIPTION:${esc((co?.notes||"")+( m.notes?("\n"+m.notes):""))}\r\n${attendees?attendees+"\r\n":""}${coContact?coContact+"\r\n":""}END:VEVENT`;
  });
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Latin Securities//Roadshow//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:REQUEST\r\n${events.join("\r\n")}\r\nEND:VCALENDAR`;
}

/* ─── Booking Page HTML Generator ───────────────────────────────── */
function buildBookingPage(trip, companies, meetings, officeAddress){
  const busySlots=new Set((meetings||[]).map(m=>`${m.date}-${m.hour}`));
  const workDays=[];
  if(trip.arrivalDate&&trip.departureDate){
    const s=new Date(trip.arrivalDate+"T12:00:00"),e=new Date(trip.departureDate+"T12:00:00");
    for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1)){
      const dow=d.getDay();
      if(dow!==0&&dow!==6) workDays.push(d.toISOString().slice(0,10));
    }
  }
  const slots=[];
  for(const day of workDays){
    // Use 30-min increments 8:30–18:00 for booking page
    const BOOK_HOURS=[9,9.5,10,10.5,11,11.5,12,12.5,14,14.5,15,15.5,16,16.5,17,17.5];
    for(const h of BOOK_HOURS){
      if(!busySlots.has(`${day}-${h}`)) slots.push({day,h});
    }
  }
  const fmtDay=iso=>new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
  const fund=trip.fund||trip.clientName||"Inversores";
  const slotList=slots.map(({day,h},i)=>`{id:"${day}-${h}",day:"${fmtDay(day)}",hour:${h}}`).join(",");
  
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Solicitar horario — ${fund} | Latin Securities</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;background:#f4f7fc;color:#1a2a3a;padding:20px}
.wrap{max-width:680px;margin:0 auto}.hdr{background:#000039;color:#fff;border-radius:12px;padding:24px 28px;margin-bottom:20px}
.hdr h1{font-size:20px;margin-bottom:4px}.hdr p{font-size:13px;opacity:.7}
.card{background:#fff;border-radius:10px;padding:20px 24px;margin-bottom:14px;box-shadow:0 2px 8px rgba(30,90,176,.08);border:1px solid rgba(30,90,176,.1)}
.card h2{font-size:14px;font-weight:700;color:#1e5ab0;margin-bottom:12px}
.slot-grid{display:grid;gap:8px}.day-section{margin-bottom:16px}
.day-label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#7a8fa8;font-family:monospace;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #eef2f8}
.slot-btn{width:100%;padding:10px 14px;border:2px solid rgba(30,90,176,.15);border-radius:8px;background:#fff;cursor:pointer;font-size:13px;text-align:left;display:flex;justify-content:space-between;align-items:center;transition:all .15s}
.slot-btn:hover{border-color:#1e5ab0;background:#f0f5ff}.slot-btn.taken{background:#fef4f4;border-color:#fcc;cursor:not-allowed;opacity:.6}
.slot-btn.selected{border-color:#1e5ab0;background:#f0f5ff;font-weight:700}
.tag{font-size:10px;padding:2px 7px;border-radius:4px;font-family:monospace}
.tag-free{background:#e8f5ee;color:#2d7a50}.tag-taken{background:#fde8e8;color:#b03030}
.form-row{margin-bottom:12px}.form-row label{display:block;font-size:12px;color:#5a6a7a;margin-bottom:4px}
.form-row input,.form-row select,.form-row textarea{width:100%;padding:8px 11px;border:1.5px solid rgba(30,90,176,.18);border-radius:6px;font-size:13px;font-family:inherit;outline:none;transition:border-color .15s}
.form-row input:focus,.form-row select:focus,.form-row textarea:focus{border-color:#1e5ab0}
.btn-submit{width:100%;padding:12px;background:#1e5ab0;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;transition:background .15s}
.btn-submit:hover{background:#3399ff}.btn-submit:disabled{background:#9ab;cursor:not-allowed}
.success{display:none;background:#e8f5ee;border:2px solid #3a8c5c;border-radius:10px;padding:20px;text-align:center;color:#2d5a3d}
.success h3{font-size:16px;margin-bottom:8px}.copy-box{background:#f4f7fc;border:1px solid #dde;border-radius:6px;padding:10px;font-family:monospace;font-size:11px;margin-top:10px;word-break:break-all}
</style></head><body><div class="wrap">
<div class="hdr"><h1>📅 Solicitar horario de reunión</h1><p>${fund} · Buenos Aires · ${trip.arrivalDate||""} – ${trip.departureDate||""}</p></div>
<div class="card"><h2>Seleccioná un horario disponible</h2>
<div id="slotContainer"></div></div>
<div class="card" id="formCard" style="display:none"><h2>Tus datos</h2>
<div class="form-row"><label>Empresa *</label><input id="fCompany" placeholder="Nombre de la empresa"/></div>
<div class="form-row"><label>Nombre del representante *</label><input id="fName" placeholder="Juan Pérez"/></div>
<div class="form-row"><label>Email *</label><input id="fEmail" type="email" placeholder="jperez@empresa.com"/></div>
<div class="form-row"><label>Teléfono (opcional)</label><input id="fPhone" placeholder="+54 11..."/></div>
<div class="form-row"><label>Lugar de preferencia</label>
<select id="fLoc"><option value="ls_office">Oficinas Latin Securities (${officeAddress||"Arenales 707, 6° Piso, CABA"})</option><option value="hq">Nuestra sede / headquarters</option><option value="other">Otro (aclarar en notas)</option></select></div>
<div class="form-row"><label>Notas adicionales (opcional)</label><textarea id="fNotes" rows="2" placeholder="Asistentes, requerimientos especiales..."></textarea></div>
<button class="btn-submit" id="btnSubmit" onclick="submitBooking()">✓ Confirmar solicitud</button></div>
<div class="success" id="successBox"><h3>✅ Solicitud enviada</h3><p>Copiá el código de confirmación y enviáselo a Latin Securities:</p><div class="copy-box" id="confirmCode"></div></div>
</div>
<script>
const SLOTS=[${slotList}];
const FUND="${fund.replace(/"/g,"'")}";
let selectedSlot=null;
const taken=JSON.parse(localStorage.getItem("rs_taken_${trip.arrivalDate||''}${trip.departureDate||''}")||"{}");

function render(){
  const grouped={};
  SLOTS.forEach(s=>{if(!grouped[s.day])grouped[s.day]=[];grouped[s.day].push(s);});
  let html="";
  Object.entries(grouped).forEach(([day,slots])=>{
    html+=\`<div class="day-section"><div class="day-label">\${day}</div>\`;
    slots.forEach(s=>{
      const key=s.id;const isTaken=!!taken[key];const isSel=selectedSlot&&selectedSlot.id===key;
      html+=\`<button class="slot-btn\${isTaken?" taken":""}\${isSel?" selected":""}" onclick="\${isTaken?"":"selectSlot('"+key+"',"+(s.h)+",'"+day+"')"}">\`;
      const fmtBH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};const endH=s.h+0.5;html+=\`<span>\${fmtBH(s.h)} – \${fmtBH(endH)} hs</span>\`;
      html+=\`<span class="tag \${isTaken?"tag-taken":"tag-free"}">\${isTaken?"Ocupado":"Disponible"}</span></button>\`;
    });
    html+="</div>";
  });
  document.getElementById("slotContainer").innerHTML=html||"<p style='color:#9ab;font-size:13px'>No hay horarios disponibles cargados.</p>";
}
function selectSlot(id,h,day){
  if(taken[id]) return;
  selectedSlot={id,h,day};
  document.getElementById("formCard").style.display="block";
  document.getElementById("formCard").scrollIntoView({behavior:"smooth",block:"start"});
  render();
}
function submitBooking(){
  const co=document.getElementById("fCompany").value.trim();
  const name=document.getElementById("fName").value.trim();
  const email=document.getElementById("fEmail").value.trim();
  if(!co||!name||!email||!selectedSlot){alert("Completá los campos obligatorios.");return;}
  taken[selectedSlot.id]={company:co,name,email,ts:Date.now()};
  localStorage.setItem("rs_taken_${trip.arrivalDate||''}${trip.departureDate||''}",JSON.stringify(taken));
  const code=btoa(JSON.stringify({slot:selectedSlot.id,company:co,name,email,fund:FUND,loc:document.getElementById("fLoc").value,notes:document.getElementById("fNotes").value,ts:Date.now()}));
  document.getElementById("confirmCode").textContent=code;
  document.getElementById("successBox").style.display="block";
  document.getElementById("formCard").style.display="none";
  document.getElementById("btnSubmit").disabled=true;
  render();
}
render();
</script></body></html>`;
}


/* ─── Travel Time & Maps Helpers ────────────────────────────────── */
function getMeetingAddress(m, co, officeAddress){
  if(m.fullAddress) return m.fullAddress;
  if(m.location==="ls_office") return officeAddress||"Arenales 707, 6° Piso, CABA, Argentina";
  if(m.location==="hq") return co?.hqAddress||co?.locationCustom||co?.name+", Buenos Aires, Argentina";
  return m.locationCustom||"Buenos Aires, Argentina";
}

// Free travel time: Nominatim geocoding + OSRM routing — no API key needed
// ── Free routing: Nominatim geocoding + OSRM ──────────────────────────────
function cleanAddr(addr){
  // Strip floor/piso/level info that confuses Nominatim ("Piso 26", "Planta 3", "Piso 6°")
  // Remove floor info: 'Piso 26', '6° Piso', 'Planta 3', 'Floor 2', 'PB', 'Oficina'
  return addr.replace(/,?\s*(\d+°?\s*)?(Piso|Planta|Floor|Level|Oficina|PB)(\s*\d+°?)?/gi,'').replace(/,?\s*\d+°(\s|,|$)/g,'$1').replace(/\s{2,}/g,' ').replace(/,\s*,/g,',').trim();
}
// geocodeAll: geocodes an array of unique addresses, 1 req/sec to respect Nominatim
async function geocodeAll(addresses){
  const unique=[...new Set(addresses)];
  const coords={};
  for(const addr of unique){
    try{
      const cleaned=cleanAddr(addr);
      const q=encodeURIComponent(cleaned+", Buenos Aires, Argentina");
      const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
        {headers:{"Accept-Language":"es","User-Agent":"LS-EventManager/1.0 latinse"}});
      if(r.ok){
        const d=await r.json();
        if(d.length) coords[addr]={lat:parseFloat(d[0].lat),lon:parseFloat(d[0].lon)};
      }
    }catch(e){/* skip */}
    await new Promise(res=>setTimeout(res,1100)); // 1 req/sec Nominatim limit
  }
  return coords;
}
async function osrmRoute(o,d){
  try{
    const url=`https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
    const ctrl=new AbortController();
    setTimeout(()=>ctrl.abort(),8000);
    const r=await fetch(url,{signal:ctrl.signal});
    if(!r.ok) return null;
    const j=await r.json();
    if(j.code!=="Ok"||!j.routes?.length) return null;
    const sec=Math.round(j.routes[0].duration);
    const km=Math.round(j.routes[0].distance/1000*10)/10;
    const min=Math.round(sec/60);
    return{durationText:min<60?`${min} min`:`${Math.floor(min/60)}h ${min%60}min`,durationSec:sec,distanceText:`${km} km`};
  }catch(e){return null;}
}

function openGoogleMapsRoute(stops){
  if(!stops.length) return;
  const origin=encodeURIComponent(stops[0]);
  const dest=encodeURIComponent(stops[stops.length-1]);
  const waypoints=stops.slice(1,-1).map(s=>encodeURIComponent(s)).join("|");
  const url=`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints?`&waypoints=${waypoints}`:""}&travelmode=driving`;
  window.open(url,"_blank");
}

function openGoogleMapsDirections(from, to){
  const url=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=driving`;
  window.open(url,"_blank");
}

// Check if two consecutive meetings have a potential conflict (not enough travel time)
function checkTravelConflict(m1, m2, travelSec, durationMin){
  const gap=(m2.hour-m1.hour)*60-(durationMin||60);
  if(travelSec==null) return gap<15?{warning:true,gapMin:gap}:null;
  const travelMin=Math.ceil(travelSec/60);
  return gap<travelMin?{conflict:true,gapMin:gap,travelMin}:gap<travelMin+10?{warning:true,gapMin:gap,travelMin}:null;
}

function RoadshowMeetingModal({mode,date,hour,meeting,companies,trip,onSave,onDelete,onClose}){
  const [type,setType]=useState(meeting?.type||"company");
  const [coId,setCoId]=useState(meeting?.companyId||"");
  const [lsType,setLsType]=useState(meeting?.lsType||LS_INT_TYPES[0]);
  const [title,setTitle]=useState(meeting?.title||"");
  const [selectedDate,setSelectedDate]=useState(meeting?.date||date||"");
  const [h,setH]=useState(String(meeting?.hour??hour??9));
  const [dur,setDur]=useState(String(meeting?.duration||60));
  const [loc,setLoc]=useState(meeting?.location||"ls_office");
  const [locCustom,setLocCustom]=useState(meeting?.locationCustom||"");
  const [status,setStatus]=useState(meeting?.status||"tentative");
  const [notes,setNotes]=useState(meeting?.notes||"");
  const [meetingFormat,setMeetingFormat]=useState(meeting?.meetingFormat||"Meeting");
  const [participants,setParticipants]=useState(meeting?.participants||"");
  const [fullAddr,setFullAddr]=useState(meeting?.fullAddress||"");
  const d=new Date((date||"2026-04-20")+"T12:00:00");
  const dateLabel=d.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const [selReps,setSelReps]=useState(meeting?.attendeeIds||[]);
  const selCo=(companies||[]).find(c=>c.id===coId);
  const coContacts=selCo?.contacts||[];
  // Sync selReps when company changes - default select all
  useEffect(()=>{if(coId&&!meeting){setSelReps(((companies||[]).find(c=>c.id===coId)?.contacts||[]).map(r=>r.id));}else if(coId&&meeting){setSelReps(meeting.attendeeIds||[]);}}, [coId]); // eslint-disable-line
  function save(){
    if(type==="company"&&!coId){alert("Seleccioná una empresa.");return;}
    const m={id:meeting?.id||`rsm-${Date.now()}`,date:selectedDate||date,hour:parseFloat(h),duration:parseInt(dur),type,
      companyId:type==="company"?coId:"",lsType:type==="ls_internal"?lsType:"",
      title:type==="custom"?title:type==="ls_internal"?lsType:"",
      location:loc,locationCustom:locCustom,status,notes,meetingFormat,
      participants:type!=="company"?participants:"",
      fullAddress:fullAddr,
      attendeeIds:type==="company"?selReps:[]};
    onSave(m);
  }
  const actCos=(companies||[]).filter(c=>c.active);
  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:460}}>
        <div className="modal-hdr"><div className="modal-title">{mode==="edit"?"Editar Reunión":"Nueva Reunión"}</div></div>
        <div className="modal-body">
          <div style={{marginBottom:12}}><div className="lbl">Día</div>
            <select className="sel" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}>
              {(()=>{
                if(!trip?.arrivalDate||!trip?.departureDate) return [<option key={selectedDate} value={selectedDate}>{selectedDate}</option>];
                const days=[];const s=new Date(trip.arrivalDate+"T12:00:00"),e=new Date(trip.departureDate+"T12:00:00");
                for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1)){
                  const iso=d.toISOString().slice(0,10);
                  const lbl=d.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
                  days.push(<option key={iso} value={iso}>{lbl.charAt(0).toUpperCase()+lbl.slice(1)}</option>);
                }
                return days;
              })()}
            </select></div>
          <div style={{marginBottom:12}}><div className="lbl">Tipo</div>
            <div style={{display:"flex",gap:5}}>
              {[["company","🏢 Empresa"],["ls_internal","🔵 LS Interno"],["custom","✏️ Otro"]].map(([v,l])=>(
                <button key={v} className={`btn bs ${type===v?"bg":"bo"}`} style={{fontSize:10,flex:1}} onClick={()=>setType(v)}>{l}</button>
              ))}
            </div></div>
          {type==="company"&&<div style={{marginBottom:12}}><div className="lbl">Empresa</div>
            <select className="sel" value={coId} onChange={e=>setCoId(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {actCos.map(c=><option key={c.id} value={c.id}>{c.name} ({c.ticker})</option>)}
            </select></div>}
          {type==="ls_internal"&&<div style={{marginBottom:12}}><div className="lbl">Reunión interna</div>
            <select className="sel" value={lsType} onChange={e=>setLsType(e.target.value)}>
              {LS_INT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select></div>}
          {type==="custom"&&<div style={{marginBottom:12}}><div className="lbl">Descripción</div>
            <input className="inp" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej: Reunión con analista político..."/></div>}
          <div className="g2" style={{gap:10,marginBottom:12}}>
            <div><div className="lbl">Hora</div>
              <select className="sel" value={h} onChange={e=>setH(e.target.value)}>
                {ROADSHOW_HOURS.map(x=><option key={x} value={x}>{fmtHour(x)}</option>)}
              </select></div>
            <div><div className="lbl">Duración</div>
              <select className="sel" value={dur} onChange={e=>setDur(e.target.value)}>
                {[[30,"30 min"],[45,"45 min"],[60,"1 hora"],[90,"1h 30min"],[120,"2 horas"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select></div>
          </div>
          <div style={{marginBottom:12}}><div className="lbl">Lugar</div>
            <select className="sel" value={loc} onChange={e=>setLoc(e.target.value)}>
              <option value="ls_office">🏛 Nuestras oficinas (LS)</option>
              <option value="hq">🏢 Sede de la empresa</option>
              <option value="custom">📍 Otro lugar</option>
            </select>
            {loc==="custom"&&<input className="inp" style={{marginTop:5}} value={locCustom} onChange={e=>setLocCustom(e.target.value)} placeholder="Dirección o lugar..."/>}
            {loc==="hq"&&selCo&&(
              <input className="inp" style={{marginTop:5,fontSize:11}} value={selCo.hqAddress||""} placeholder={`Dirección HQ de ${selCo.name}...`}
                onChange={e=>{/* update company hqAddress inline */const patch=e.target.value;if(typeof window.__rsCoPatch==="function")window.__rsCoPatch(selCo.id,"hqAddress",patch);}}
              />
            )}
            <div style={{marginTop:5}}>
              <div className="lbl" style={{marginBottom:2,fontSize:9}}>Dirección completa (para Google Maps)</div>
              <input className="inp" style={{fontSize:11}} value={fullAddr} onChange={e=>setFullAddr(e.target.value)}
                placeholder={loc==="ls_office"?(trip?.officeAddress||"Arenales 707, 6° Piso, CABA"):loc==="hq"?(selCo?.hqAddress||"Dirección de la empresa..."):locCustom||"Dirección exacta..."}/>
            </div>
          </div>
          <div className="g2" style={{gap:10,marginBottom:12}}>
            <div><div className="lbl">Estado</div>
            <div style={{display:"flex",gap:5}}>
              {[["tentative","⏳ Tentativo"],["confirmed","✅ Confirmado"],["cancelled","❌ Cancelado"]].map(([v,l])=>(
                <button key={v} className={`btn bs ${status===v?"bg":"bo"}`} style={{fontSize:10,flex:1}} onClick={()=>setStatus(v)}>{l}</button>
              ))}
            </div></div>
            <div><div className="lbl">Formato</div>
              <select className="sel" value={meetingFormat} onChange={e=>setMeetingFormat(e.target.value)}>
                {["Meeting","Breakfast Meeting","Lunch","Dinner","Conference Call","Roadshow Presentation","Site Visit"].map(f=><option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:12}}><div className="lbl">Notas / Agenda</div>
            <textarea className="inp" style={{minHeight:54,resize:"vertical"}} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Temas a tratar, contexto, agenda..."/></div>
          {type!=="company"&&(
            <div style={{marginBottom:12}}><div className="lbl">👥 Participantes</div>
              <input className="inp" value={participants} onChange={e=>setParticipants(e.target.value)}
                placeholder="Ej: Rodrigo Nistor, Martin Tapia, Daniela Ramos"/>
              <div style={{fontSize:9,color:"var(--dim)",marginTop:3}}>Nombres separados por coma</div>
            </div>
          )}
          {type==="company"&&coContacts.length>0&&(
            <div style={{marginBottom:4}}>
              <div className="lbl" style={{marginBottom:5}}>👤 Asistentes de la empresa</div>
              <div style={{display:"flex",flexDirection:"column",gap:4,background:"var(--ink3)",borderRadius:6,padding:"6px 8px"}}>
                {coContacts.map(r=>(
                  <label key={r.id} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"3px 4px",borderRadius:4,background:selReps.includes(r.id)?"rgba(30,90,176,.08)":"transparent"}}>
                    <input type="checkbox" style={{accentColor:"var(--gold)"}} checked={selReps.includes(r.id)}
                      onChange={()=>setSelReps(p=>p.includes(r.id)?p.filter(x=>x!==r.id):[...p,r.id])}/>
                    <div style={{flex:1}}>
                      <span style={{fontSize:12,color:"var(--cream)",fontWeight:600}}>{r.name}</span>
                      {r.title&&<span style={{fontSize:10,color:"var(--dim)",marginLeft:5}}>{r.title}</span>}
                    </div>
                    {r.email&&<span style={{fontSize:9,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>{r.email}</span>}
                  </label>
                ))}
                <div style={{display:"flex",justifyContent:"flex-end",gap:6,marginTop:4,paddingTop:4,borderTop:"1px solid rgba(30,90,176,.07)"}}>
                  <button className="btn bo bs" style={{fontSize:9,padding:"2px 7px"}} onClick={()=>setSelReps(coContacts.map(r=>r.id))}>Todos</button>
                  <button className="btn bo bs" style={{fontSize:9,padding:"2px 7px"}} onClick={()=>setSelReps([])}>Ninguno</button>
                </div>
              </div>
            </div>
          )}
          {type==="company"&&coContacts.length===0&&coId&&(
            <div style={{fontSize:11,color:"var(--dim)",background:"var(--ink3)",borderRadius:5,padding:"6px 10px",marginBottom:4}}>
              ℹ Sin representantes cargados para esta empresa. Agregalos en la tab Empresas.
            </div>
          )}
        </div>
        <div className="modal-footer" style={{gap:7}}>
          {mode==="edit"&&<button className="btn bd bs" onClick={onDelete}>🗑 Eliminar</button>}
          <button className="btn bo bs" onClick={onClose}>Cancelar</button>
          <button className="btn bg bs" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
function RoadshowEmailModal({company,emailData,onClose}){
  const [copied,setCopied]=useState(false);
  function copy(){const t=`Para: ${emailData.to}\nAsunto: ${emailData.subject}\n\n${emailData.body}`;navigator.clipboard.writeText(t).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}).catch(()=>{const w=window.open("","_blank","width=680,height=520");w.document.write("<pre style='font:13px monospace;padding:20px;white-space:pre-wrap'>"+t.replace(/</g,"&lt;")+"</pre>");w.document.close();});}
  function openMail(){window.location.href=`mailto:${encodeURIComponent(emailData.to)}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;}
  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:610}}>
        <div className="modal-hdr"><div className="modal-title">✉️ {company.name}</div></div>
        <div className="modal-body">
          <div style={{marginBottom:8}}><div className="lbl">Para</div>
            <div style={{fontSize:12,color:emailData.to?"var(--txt)":"var(--red)",background:"var(--ink3)",padding:"5px 10px",borderRadius:5,fontFamily:"IBM Plex Mono,monospace"}}>
              {emailData.to||"⚠ Completar email en la sección Empresas"}</div></div>
          <div style={{marginBottom:10}}><div className="lbl">Asunto</div>
            <div style={{fontSize:12,color:"var(--cream)",background:"var(--ink3)",padding:"5px 10px",borderRadius:5,fontWeight:600}}>{emailData.subject}</div></div>
          <div><div className="lbl">Cuerpo del email (español)</div>
            <pre style={{fontFamily:"Lora,Georgia,serif",fontSize:12,color:"var(--txt)",background:"var(--ink3)",padding:"12px 14px",borderRadius:6,whiteSpace:"pre-wrap",maxHeight:340,overflowY:"auto",lineHeight:1.75}}>{emailData.body}</pre></div>
        </div>
        <div className="modal-footer" style={{gap:7}}>
          <button className="btn bo bs" onClick={onClose}>Cerrar</button>
          <button className="btn bo bs" onClick={openMail}>📧 Abrir en Mail</button>
          <button className={`btn bs ${copied?"bo":"bg"}`} onClick={copy}>{copied?"✅ ¡Copiado!":"📋 Copiar todo"}</button>
        </div>
      </div>
    </div>
  );
}

function InvestorModal({inv,investors,meetings,companies,fundGrouping,allSlots,config:invCfg,onUpdateInv,onToggleFundGroup,onExport,onClose}){
  const cfg=invCfg||DEFAULT_CONFIG;
  const [activeTab,setActiveTab]=useState("profile");
  const [editField,setEditField]=useState({});
  const invMeetings=meetings.filter(m=>(m.invIds||[]).includes(inv.id)).sort((a,b)=>allSlots.indexOf(a.slotId)-allSlots.indexOf(b.slotId));
  const fundmates=investors.filter(i=>i.id!==inv.id&&i.fund===inv.fund&&inv.fund);
  const isGrouped=inv.fund?(fundGrouping[inv.fund]!==false):false;
  const activeHours=[...new Set(allSlots.map(s=>slotHour(s)))];

  function toggleSlot(slotId){
    const base=inv.slots||[];
    if(!base.includes(slotId)) onUpdateInv({...inv,slots:[...base,slotId].sort((a,b)=>allSlots.indexOf(a)-allSlots.indexOf(b))});
    else{const bl=inv.blockedSlots||[];if(bl.includes(slotId)) onUpdateInv({...inv,blockedSlots:bl.filter(s=>s!==slotId)});else onUpdateInv({...inv,blockedSlots:[...bl,slotId]});}
  }
  function toggleCo(coId){const cos=inv.companies||[];if(cos.includes(coId)) onUpdateInv({...inv,companies:cos.filter(c=>c!==coId)});else onUpdateInv({...inv,companies:[...cos,coId]});}
  const eff=effectiveSlots(inv,allSlots);

  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:680}}>
        <div className="modal-hdr">
          <div className="modal-title">{inv.name}</div>
          <div className="modal-sub">{[inv.position,inv.fund].filter(Boolean).join(" · ")}</div>
          <div className="modal-tabs" style={{marginTop:14}}>
            {[["profile","👤 Perfil"],["restrictions","🕐 Horarios"],["companies","🏢 Compañías"],["meetings","📅 Reuniones"]].map(([t,l])=>(
              <button key={t} className={`mtab${activeTab===t?" on":""}`} onClick={()=>setActiveTab(t)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="modal-body">
          {activeTab==="profile"&&(
            <div>
              <div className="g2" style={{gap:12,marginBottom:14}}>
                {[["name","Nombre completo","text"],["fund","Fondo / Firma","text"],["position","Cargo","text"],["email","Email","email"],["phone","Teléfono","text"],["aum","AUM","text"]].map(([f,label,type])=>(
                  <div key={f}><div className="lbl">{label}</div>
                    <input className="inp" type={type} value={editField[f]!==undefined?editField[f]:(inv[f]||"")}
                      onChange={e=>setEditField(p=>({...p,[f]:e.target.value}))}
                      onBlur={()=>{if(editField[f]!==undefined){const u={...inv,...editField};if(f==="name")u.name=capitalizeName(u.name);onUpdateInv(u);setEditField({});}}}/>
                  </div>
                ))}
              </div>
              {fundmates.length>0&&(
                <div className="fund-group">
                  <div style={{flex:1}}>
                    <div style={{fontSize:12.5,color:"var(--cream)"}}>Agrupar con colegas del mismo fondo</div>
                    <div style={{fontSize:11,color:"var(--dim)",marginTop:2}}>{fundmates.map(f=>f.name).join(", ")}</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={isGrouped} onChange={()=>onToggleFundGroup(inv.fund,!isGrouped)}/>
                    <div className="toggle-track"/><div className="toggle-thumb"/>
                  </label>
                </div>
              )}
            </div>
          )}
          {activeTab==="restrictions"&&(
            <div>
              <p style={{fontSize:12,color:"var(--dim)",marginBottom:12,lineHeight:1.7}}>Verde = disponible · Rojo = bloqueado · Clic para togglear. Gris = fuera de disponibilidad declarada.</p>
              <div style={{fontSize:11,color:"var(--txt)",marginBottom:10}}><span className="bdg bg-grn">{eff.length}</span> slots efectivos de {allSlots.length}</div>
              {getDayIds(cfg).map(d=>(
                <div key={d} style={{marginBottom:14}}>
                  <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:10,color:getDayIds(cfg).indexOf(d)%2===0?"var(--blu)":"var(--grn)",marginBottom:6,letterSpacing:".06em",textTransform:"uppercase"}}>◆ {getDayShort(cfg)[d]||d}</div>
                  <div style={{display:"grid",gridTemplateColumns:`repeat(${activeHours.length},1fr)`,gap:3}}>
                    {activeHours.map(h=>{const sid=`${d}-${h}`;const inBase=(inv.slots||[]).includes(sid);const isBlocked=(inv.blockedSlots||[]).includes(sid);
                      return <div key={h} className={`slot-cell ${!inBase?"slot-na":isBlocked?"slot-blocked":"slot-avail"}`} onClick={()=>inBase&&toggleSlot(sid)}>{hourLabel(h)}</div>;})}
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab==="companies"&&(
            <div>
              <p style={{fontSize:12,color:"var(--dim)",marginBottom:12}}>Compañías que este inversor quiere reunirse:</p>
              {["Financials","Energy","Infra","Real Estate","TMT","LS"].map(sector=>{
                const scos=COMPANIES_INIT.filter(c=>c.sector===sector); if(!scos.length) return null;
                return(<div key={sector}><div className="sec-hdr">{sector}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}>
                    {scos.map(c=>{const on=(inv.companies||[]).includes(c.id);return(
                      <div key={c.id} onClick={()=>toggleCo(c.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:6,cursor:"pointer",background:on?"rgba(30,90,176,.1)":"rgba(255,255,255,.03)",border:`1px solid ${on?"rgba(30,90,176,.22)":"rgba(255,255,255,.06)"}`,transition:"all .12s"}}>
                        <div style={{width:14,height:14,borderRadius:3,background:on?"var(--gold)":"rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:10,color:"var(--ink)",fontWeight:700}}>{on?"✓":""}</div>
                        <span style={{fontSize:12,color:on?"var(--cream)":"var(--dim)"}}>{c.name}</span>
                        <span className="bdg bg-g" style={{marginLeft:"auto",fontSize:9}}>{c.ticker}</span>
                      </div>);})}
                  </div></div>);
              })}
            </div>
          )}
          {activeTab==="meetings"&&(
            invMeetings.length===0?<div className="alert ai" aria-live="polite">Sin reuniones asignadas.</div>
            :<table className="tbl"><thead><tr><th>Día</th><th>Hora</th><th>Compañía</th><th>Sala</th></tr></thead>
              <tbody>{invMeetings.map(m=>{const co=coById.get(m.coId);return(<tr key={m.id}>
                <td><span className={`bdg ${getDayIds(cfg).indexOf(slotDay(m.slotId))%2===0?"bg-b":"bg-grn"}`}>{getDayShort(cfg)[slotDay(m.slotId)]||slotDay(m.slotId)}</span></td>
                <td style={{fontFamily:"IBM Plex Mono,monospace",fontWeight:600,fontSize:11}}>{slotLabel(m.slotId)}</td>
                <td style={{color:"var(--cream)",fontWeight:600}}>{co?.name}<span className="bdg bg-g" style={{marginLeft:6}}>{co?.ticker}</span></td>
                <td style={{fontFamily:"IBM Plex Mono,monospace",fontSize:11,color:"var(--gold)"}}>{m.room}</td>
              </tr>);})}</tbody></table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn bo bs" onClick={()=>onExport(inv,"pdf")}>📄 PDF</button>
          <button className="btn bo bs" onClick={()=>onExport(inv,"word")}>📝 Word</button>
          <button className="btn bg bs" style={{marginLeft:8}} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPANY PROFILE MODAL
═══════════════════════════════════════════════════════════════════ */
function CompanyModal({co,meetings,investors,allSlots,onUpdateCo,onExport,onClose}){
  const [activeTab,setActiveTab]=useState("info");
  const [newName,setNewName]=useState("");const [newTitle,setNewTitle]=useState("");
  const coMeetings=meetings.filter(m=>m.coId===co.id).sort((a,b)=>allSlots.indexOf(a.slotId)-allSlots.indexOf(b.slotId));
  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:600}}>
        <div className="modal-hdr">
          <div style={{display:"flex",alignItems:"baseline",gap:10}}>
            <div className="modal-title">{co.name}</div><span className="bdg bg-g">{co.ticker}</span>
          </div>
          <div className="modal-sub" style={{color:SEC_CLR[co.sector]}}>{co.sector}</div>
          <div className="modal-tabs" style={{marginTop:14}}>
            {[["info","🏢 Info"],["attendees","👤 Asistentes"],["meetings","📅 Reuniones"]].map(([t,l])=>(
              <button key={t} className={`mtab${activeTab===t?" on":""}`} onClick={()=>setActiveTab(t)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="modal-body">
          {activeTab==="info"&&(
            <div><div className="g2" style={{gap:12}}>
              {[["name","Nombre"],["ticker","Ticker"],["sector","Sector"]].map(([f,label])=>(
                <div key={f}><div className="lbl">{label}</div>
                  <input className="inp" value={co[f]||""} onChange={e=>onUpdateCo({...co,[f]:e.target.value})}/></div>
              ))}
            </div>
            <div style={{marginTop:14,padding:12,background:"var(--ink3)",borderRadius:7,fontSize:12,color:"var(--dim)"}}>
              <strong style={{color:"var(--txt)"}}>Reuniones:</strong> {coMeetings.length} · <strong style={{color:"var(--txt)"}}>Inversores únicos:</strong> {new Set(coMeetings.flatMap(m=>m.invIds)).size}
            </div></div>
          )}
          {activeTab==="attendees"&&(
            <div>
              <p style={{fontSize:12,color:"var(--dim)",marginBottom:12}}>Representantes de la compañía en el evento:</p>
              {(co.attendees||[]).map((a,i)=>(
                <div key={i} className="attendee-row">
                  <div style={{flex:1}}><div style={{fontSize:13,color:"var(--cream)"}}>{a.name}</div>{a.title&&<div style={{fontSize:11,color:"var(--dim)"}}>{a.title}</div>}</div>
                  <button aria-label="Eliminar representante" className="btn bd bs" onClick={()=>onUpdateCo({...co,attendees:(co.attendees||[]).filter((_,j)=>j!==i)})}>✕</button>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <div style={{flex:1}}><div className="lbl">Nombre</div><input className="inp" placeholder="Juan García" value={newName} onChange={e=>setNewName(e.target.value)}/></div>
                <div style={{flex:1}}><div className="lbl">Cargo</div><input className="inp" placeholder="CEO" value={newTitle} onChange={e=>setNewTitle(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&newName.trim()){onUpdateCo({...co,attendees:[...(co.attendees||[]),{name:newName.trim(),title:newTitle.trim()}]});setNewName("");setNewTitle("");}}}/>
                </div>
                <button className="btn bg bs" style={{alignSelf:"flex-end"}} onClick={()=>{if(newName.trim()){onUpdateCo({...co,attendees:[...(co.attendees||[]),{name:newName.trim(),title:newTitle.trim()}]});setNewName("");setNewTitle("");}}}> + </button>
              </div>
            </div>
          )}
          {activeTab==="meetings"&&(
            coMeetings.length===0?<div className="alert ai" aria-live="polite">Sin reuniones asignadas.</div>
            :<table className="tbl"><thead><tr><th>Día</th><th>Hora</th><th>Inversor(es)</th><th>Sala</th></tr></thead>
              <tbody>{coMeetings.map(m=>{const invs=(m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);return(<tr key={m.id}>
                <td><span className={`bdg ${getDayIds(cfg).indexOf(slotDay(m.slotId))%2===0?"bg-b":"bg-grn"}`}>{getDayShort(cfg)[slotDay(m.slotId)]||slotDay(m.slotId)}</span></td>
                <td style={{fontFamily:"IBM Plex Mono,monospace",fontWeight:600,fontSize:11}}>{slotLabel(m.slotId)}</td>
                <td>{invs.map(inv=>(<div key={inv.id} style={{fontSize:12,color:"var(--cream)"}}>{inv.name}<span style={{color:"var(--dim)",fontSize:10}}> — {inv.fund}</span></div>))}</td>
                <td style={{fontFamily:"IBM Plex Mono,monospace",fontSize:11,color:"var(--gold)"}}>{m.room}</td>
              </tr>);})}</tbody></table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn bo bs" onClick={()=>onExport(co,"pdf")}>📄 PDF</button>
          <button className="btn bo bs" onClick={()=>onExport(co,"word")}>📝 Word</button>
          <button className="btn bg bs" style={{marginLeft:8}} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MEETING MODAL
═══════════════════════════════════════════════════════════════════ */
function MeetingModal({mode,meeting,investors,meetings,companies,allSlots,rooms,config:modalConfig,onSave,onDelete,onClose}){
  const cfg = modalConfig||DEFAULT_CONFIG;
  const invById=new Map((investors||[]).map(i=>[i.id,i]));
  const coById=new Map((companies||[]).map(c=>[c.id,c]));
  const [invIds,setInvIds]=useState(meeting?.invIds||[]);
  const [coId,setCoId]=useState(meeting?.coId||"");
  const [slotId,setSlotId]=useState(meeting?.slotId||"");
  const [room,setRoom]=useState(meeting?.room||rooms[0]);
  const hours=[...new Set(allSlots.map(s=>slotHour(s)))];
  // Build lookup Sets once for O(1) conflict detection (js-set-map-lookups)
  const conflicts=useMemo(()=>{
    const c=[];if(!invIds.length||!coId||!slotId) return c;
    const others=meetings.filter(m=>m.id!==meeting?.id&&m.slotId===slotId);
    const busyInvs=new Set(others.flatMap(m=>m.invIds||[]));
    const busyCos=new Set(others.map(m=>m.coId));
    const busyRooms=new Set(others.map(m=>m.room).filter(Boolean));
    for(const invId of invIds){if(busyInvs.has(invId)) c.push(`${invById.get(invId)?.name} ya tiene reunión`);}
    if(busyCos.has(coId)) c.push(`${coById.get(coId)?.name} ya tiene reunión`);
    if(room&&busyRooms.has(room)) c.push(`${room} ocupada`);
    return c;
  },[invIds,coId,slotId,room,meetings,meeting,invById,coById]);
  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:500}}>
        <div className="modal-hdr"><div className="modal-title">{mode==="add"?"Nueva Reunión":"Editar Reunión"}</div></div>
        <div className="modal-body">
          <div style={{marginBottom:13}}><div className="lbl">Inversor(es)</div>
            <div style={{maxHeight:150,overflowY:"auto",background:"var(--ink3)",borderRadius:6,border:"1px solid rgba(30,90,176,.12)",padding:6}}>
              {investors.map(inv=>(<label key={inv.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 6px",cursor:"pointer",borderRadius:4,background:invIds.includes(inv.id)?"rgba(30,90,176,.1)":"transparent"}}>
                <input type="checkbox" checked={invIds.includes(inv.id)} onChange={()=>setInvIds(p=>p.includes(inv.id)?p.filter(x=>x!==inv.id):[...p,inv.id])} style={{accentColor:"var(--gold)"}}/>
                <span style={{fontSize:12,color:"var(--txt)"}}>{inv.name}</span>
                <span style={{fontSize:10,color:"var(--dim)",marginLeft:"auto"}}>{inv.fund}</span>
              </label>))}
            </div>
          </div>
          <div className="g2" style={{gap:12,marginBottom:12}}>
            <div><div className="lbl">Compañía</div>
              <select className="sel" value={coId} onChange={e=>setCoId(e.target.value)}>
                <option value="">-- seleccionar --</option>
                {companies.map(c=><option key={c.id} value={c.id}>{c.name} ({c.ticker})</option>)}
              </select>
            </div>
            <div><div className="lbl">Sala</div>
              <select className="sel" value={room} onChange={e=>setRoom(e.target.value)}>
                {rooms.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div><div className="lbl">Día y Hora</div>
            <select className="sel" value={slotId} onChange={e=>setSlotId(e.target.value)}>
              <option value="">-- seleccionar --</option>
              {getDayIds(cfg).map(d=><optgroup key={d} label={getDayShort(cfg)[d]||d}>{hours.map(h=><option key={`${d}-${h}`} value={`${d}-${h}`}>{getDayShort(cfg)[d]||d} {hourLabel(h)}</option>)}</optgroup>)}
            </select>
          </div>
          {conflicts.length>0&&<div className="alert aw" aria-live="polite" style={{marginTop:10}}>⚠ Conflicto: {conflicts.join(" · ")}<br/><span style={{fontSize:10,color:"var(--dim)"}}>Cambiá el horario o la sala para resolver el conflicto.</span></div>}
        </div>
        <div className="modal-footer">
          {mode==="edit"&&<button className="btn bd bs" onClick={onDelete}>🗑 Eliminar</button>}
          <button className="btn bo bs" onClick={onClose}>Cancelar</button>
          <button className="btn bg bs" disabled={!invIds.length||!coId||!slotId||conflicts.length>0} onClick={()=>onSave({invIds,coId,slotId,room})} style={{opacity:(!invIds.length||!coId||!slotId||conflicts.length>0)?.5:1}}>
            {mode==="add"?"Agregar":"Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
export default function App(){
  // ── Events (persistence) ──────────────────────────────────────
  const [globalDB,setGlobalDB] = useState(()=>loadDB());
  function saveGlobalDB(db){setGlobalDB(db);saveDB(db);}
  const [dbTab,setDbTab]       = useState("companies");  // companies | investors
  const [dbSubTab,setDbSubTab] = useState("list");
  const [coSearch,setCoSearch] = useState("");
  const [invSearch,setInvSearch]= useState("");
  const [editCo,setEditCo]     = useState(null);
  const [editInv,setEditInv]   = useState(null);
  const [events,setEvents]   = useState(()=>loadEvents());
  const [activeEv,setActiveEv] = useState(()=>{ const evs=loadEvents(); return evs.length?evs[0].id:null; });
  const [newEvName,setNewEvName] = useState("");
  const [newEvKind,setNewEvKind] = useState("conference");

  const currentEvent = events.find(e=>e.id===activeEv);

  function saveCurrentEvent(patch){
    setEvents(prev=>{
      const next=prev.map(e=>e.id===activeEv?{...e,...patch}:e);
      saveEvents(next);return next;
    });
  }

  // ── Derived state from active event ──────────────────────────
  const investors   = currentEvent?.investors||[];
  const companies   = currentEvent?.companies||COMPANIES_INIT.map(c=>({...c,attendees:[]}));
  const meetings    = currentEvent?.meetings||[];
  const unscheduled = currentEvent?.unscheduled||[];
  const fixedRoom   = currentEvent?.fixedRoom||{};
  const fundGrouping= currentEvent?.fundGrouping||{};
  const fundSimilarities= currentEvent?.fundSimilarities||[];
  const config      = currentEvent?.config||DEFAULT_CONFIG;

  function setInvestors(fn){ saveCurrentEvent({investors:typeof fn==="function"?fn(investors):fn}); }
  function setCompanies(fn){ saveCurrentEvent({companies:typeof fn==="function"?fn(companies):fn}); }
  function setMeetings(fn) { saveCurrentEvent({meetings:typeof fn==="function"?fn(meetings):fn}); }
  function setConfig(fn)   { saveCurrentEvent({config:typeof fn==="function"?fn(config):fn}); }
  function setFundGrouping(fn){ saveCurrentEvent({fundGrouping:typeof fn==="function"?fn(fundGrouping):fn}); }

  // ── Computed from config ──────────────────────────────────────
  const allSlots = makeSlots(config.hours, config);
  const rooms    = getRooms(config);

  // ── UI state (not persisted) ──────────────────────────────────
  const [tab,setTab]         = useState("upload");
  const [moverStocks,setMoverStocks]   = useState(()=>{try{return JSON.parse(localStorage.getItem("ls_movers")||"[]");}catch{return [];}});
  const [moverCCL,setMoverCCL]         = useState(null);
  const [moverCCLLoading,setMoverCCLLoading] = useState(false);
  const [moverCCLErr,setMoverCCLErr]   = useState(null);
  const [moverCCLManual,setMoverCCLManual] = useState("");
  const OB_DEF={team:[],destinations:[],notes:"",fund:"",subtitle:""};
  const [outbound,setOutbound]=useState(()=>{try{const ev=events.find(e=>e.id===activeEv);return ev?.outbound||OB_DEF;}catch{return OB_DEF;}});
  function saveOutbound(ob){setOutbound(ob);saveCurrentEvent({outbound:ob});}
  const [obSubTab,setObSubTab]=useState("schedule");
  const [roadshow,setRoadshow]=useState(()=>{try{const ev=events.find(e=>e.id===activeEv);return ev?.roadshow||{trip:RS_TRIP_DEF,companies:RS_COS_DEF,meetings:[]};}catch{return{trip:RS_TRIP_DEF,companies:RS_COS_DEF,meetings:[]};} });
  const [rsMtgModal,setRsMtgModal]=useState(null);
  const [rsEmailModal,setRsEmailModal]=useState(null);
  const [rsSubTab,setRsSubTab]=useState("schedule");
  const [rsEmailParser,setRsEmailParser]=useState("");
  const [rsAgendaEmailModal,setRsAgendaEmailModal]=useState(false);
  const [travelCache,setTravelCache]=useState({});
  const [travelLoading,setTravelLoading]=useState(false);
  const [rsShowParser,setRsShowParser]=useState(false);
  const [prevYearData,setPrevYearData] = useState(null);
  const prevYearRef = useRef();
  const [historicalYears,setHistoricalYears] = useState([]);
  const histFileRef = useRef();
  const rsExcelRef = useRef();
  const dbCoExcelRef  = useRef();
  const dbInvExcelRef = useRef();
  const rsMtgsExcelRef = useRef();
  const [activeDay,setActiveDay] = useState("apr14");
  const [schedView,setSchedView] = useState("company"); // "company" | "room"
  const [moveSrc,setMoveSrc] = useState(null); // meeting id being moved
  const [search,setSearch]   = useState("");
  const [fileName,setFileName] = useState("");
  const [modal,setModal]     = useState(null);
  const [invProfile,setInvProfile] = useState(null);
  const [coProfile,setCoProfile]   = useState(null);
  const [showEvMgr,setShowEvMgr]   = useState(false);
  const [showAddCo,setShowAddCo]   = useState(false);
  const [newCoForm,setNewCoForm]   = useState({name:"",ticker:"",sector:"Financials"});
  const fileRef = useRef();
  const scheduled = meetings.length>0;

  // ── Create new event ─────────────────────────────────────────
  function createEvent(name, kind="conference"){
    if(events.some(e=>e.name.trim().toLowerCase()===name.trim().toLowerCase())){
      alert(`Ya existe un evento con el nombre "${name}". Usá un nombre diferente.`);
      return;
    }
    const id=`ev-${Date.now()}`;
    const ev={id,name,kind,createdAt:new Date().toISOString(),
      investors:[],companies:COMPANIES_INIT.map(c=>({...c,attendees:[]})),
      meetings:[],unscheduled:[],fixedRoom:{},fundGrouping:{},config:DEFAULT_CONFIG};
    const next=[...events,ev]; setEvents(next); saveEvents(next); setActiveEv(id); setNewEvName("");
    setTab(kind==="roadshow"?"roadshow":kind==="outbound"?"outbound":"upload");
  }

  // ── File parse ───────────────────────────────────────────────
  const handleFile=useCallback(e=>{
    const file=e.target.files?.[0]; if(!file) return;
    setFileName(file.name);
    const reader=new FileReader();
    reader.onload=ev=>{
      const wb=XLSX.read(ev.target.result,{type:"array"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1});
      if(rows.length<2) return;
      const hdrs=rows[0].map(String);
      const ci=pred=>hdrs.findIndex(h=>pred(h.toLowerCase().replace(/[\s\n]+/g," ").trim()));
      const fi=ci(h=>h==="fund"),ni=ci(h=>h==="name"),si=ci(h=>h.startsWith("surname"));
      const pi=ci(h=>h.startsWith("position")),ei=ci(h=>h==="email"),phi=ci(h=>h.includes("mobile")||h.includes("phone"));
      const ai=ci(h=>h==="aum"),ti=ci(h=>h.includes("preferred meeting date")),coi=ci(h=>h.includes("which meetings"));
      const g=(row,i)=>i>=0?String(row[i]??"").trim():"";
      const parsed=rows.slice(1).filter(row=>g(row,fi)||g(row,ni)).map((row,ri)=>({
        id:`inv-${ri}`,name:capitalizeName([g(row,ni),g(row,si)].filter(Boolean).join(" "))||`Inversor ${ri+1}`,
        fund:normalizeFundName(g(row,fi)),email:g(row,ei),phone:g(row,phi),position:normalizePosition(g(row,pi)),aum:normalizeAUM(g(row,ai)),
        companies:[...new Set(g(row,coi).split(";").map(s=>s.trim()).filter(Boolean).map(resolveCo).filter(Boolean))],
        slots:parseAvail(g(row,ti),config.hours,config),blockedSlots:[],notes:""
      }));
      const fg={};const fm={};
      parsed.forEach(inv=>{if(inv.fund){fm[inv.fund]=(fm[inv.fund]||0)+1;}});
      Object.entries(fm).forEach(([f,n])=>{if(n>1)fg[f]=true;});
      // Apply fuzzy fund normalization
      const aliasMap = buildFundAliasMap(parsed);
      const normalized = parsed.map(inv=>({...inv, fund: inv.fund ? aliasMap[inv.fund]||inv.fund : inv.fund}));
      // Detect similar-but-different funds that got merged → suggest grouping
      const fundSimilarities = [];
      const seenNorms={};
      parsed.forEach(inv=>{
        if(!inv.fund) return;
        const norm=normalizeFund(inv.fund);
        if(!norm) return;
        if(seenNorms[norm] && seenNorms[norm]!==inv.fund){
          const pair=[seenNorms[norm],inv.fund].sort().join("|||");
          if(!fundSimilarities.find(p=>p.pair===pair)) fundSimilarities.push({pair,canonical:aliasMap[inv.fund],variant:inv.fund,original:seenNorms[norm]});
        } else seenNorms[norm]=inv.fund;
      });
      const fg2={};const fm2={};
      normalized.forEach(inv=>{if(inv.fund){fm2[inv.fund]=(fm2[inv.fund]||0)+1;}});
      Object.entries(fm2).forEach(([f,n])=>{if(n>1)fg2[f]=true;});
      saveCurrentEvent({investors:normalized,fundGrouping:fg2,meetings:[],unscheduled:[],fixedRoom:{},fundSimilarities});
      setTab("investors");
    };
    reader.readAsArrayBuffer(file);
  },[config.hours,activeEv]);

  // ── Previous year comparison ────────────────────────────────
  const handlePrevYear = useCallback(e=>{
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      const wb=XLSX.read(ev.target.result,{type:"array"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1});
      if(rows.length<2){alert("Archivo vacío o inválido.");return;}
      const hdrs=rows[0].map(String);
      const ci=pred=>hdrs.findIndex(h=>pred(h.toLowerCase().replace(/[ \t\n\r]+/g," ").trim()));
      const fi=ci(h=>h==="fund"),ni=ci(h=>h==="name"),si=ci(h=>h.startsWith("surname")),ei=ci(h=>h==="email");
      const g=(row,i)=>i>=0?String(row[i]??"").trim():"";
      const prevList=rows.slice(1).filter(row=>g(row,fi)||g(row,ni)).map((row,ri)=>({
        name:capitalizeName([g(row,ni),g(row,si)].filter(Boolean).join(" "))||`Inv ${ri+1}`,
        fund:normalizeFundName(g(row,fi)),
        email:g(row,ei).toLowerCase().trim(),
      }));
      // Match against current investors by email (primary) or name+fund (fallback)
      const currentEmails=new Set(investors.map(i=>i.email?.toLowerCase().trim()).filter(Boolean));
      const currentNameFund=new Set(investors.map(i=>`${normalizeFund(i.name||"")}|||${normalizeFund(i.fund||"")}`));
      const missing=prevList.filter(p=>{
        if(p.email && currentEmails.has(p.email)) return false;
        const key=`${normalizeFund(p.name)}|||${normalizeFund(p.fund)}`;
        if(currentNameFund.has(key)) return false;
        return true;
      });
      setPrevYearData({fileName:file.name, total:prevList.length, missing});
    };
    reader.readAsArrayBuffer(file);
  },[investors]);

  // ── Historical multi-year parser ─────────────────────────────
  const parseHistoricalFile = useCallback((file, year) => {
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, {type:"array"});
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, {header:1});
        if (rows.length < 2) { alert("Archivo vacío o inválido."); return; }
        const hdrs = rows[0].map(String);
        const ci = pred => hdrs.findIndex(h => pred(h.toLowerCase().replace(/[ \t\n\r]+/g," ").trim()));
        const fi=ci(h=>h==="fund"), ni=ci(h=>h==="name"), si=ci(h=>h.startsWith("surname")), ei=ci(h=>h==="email");
        const coi=ci(h=>h.includes("which meetings"));
        const g=(row,i)=>i>=0?String(row[i]??"").trim():"";
        const parsed = rows.slice(1).filter(row=>g(row,fi)||g(row,ni)).map((row,ri) => ({
          name: capitalizeName([g(row,ni),g(row,si)].filter(Boolean).join(" ")) || `Inv ${ri+1}`,
          fund: normalizeFundName(g(row,fi)),
          email: g(row,ei).toLowerCase().trim(),
          companies: coi>=0 ? [...new Set(g(row,coi).split(";").map(s=>s.trim()).filter(Boolean).map(resolveCo).filter(Boolean))] : [],
        }));
        if (parsed.length === 0) { alert(`No se encontraron inversores en el archivo. Verificá que tenga columnas Name/Fund.`); return; }
        setHistoricalYears(prev => {
          const filtered = prev.filter(y => y.year !== year);
          return [...filtered, {year, fileName: file.name, investors: parsed}].sort((a,b)=>a.year.localeCompare(b.year));
        });
      } catch(err) {
        alert("Error al procesar el archivo: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  // ── Generate ─────────────────────────────────────────────────
  function generate(){
    const res=runSchedule(investors,fundGrouping,config);
    saveCurrentEvent({meetings:res.meetings,unscheduled:res.unscheduled,fixedRoom:res.fixedRoom});
    setTab("schedule");
  }

  // ── Meeting edits ────────────────────────────────────────────
  function handleMeetingSave({invIds,coId,slotId,room}){
    const id=modal.mode==="edit"?modal.meeting.id:`m-${Date.now()}-${Math.random().toString(36).slice(2,5)}`;
    if(modal.mode==="edit") setMeetings(prev=>prev.map(m=>m.id===id?{...m,invIds,coId,slotId,room}:m));
    else setMeetings(prev=>[...prev,{id,invIds,coId,slotId,room}]);
    setModal(null);
  }

  // ── Export ───────────────────────────────────────────────────
  function openPrint(html){const w=window.open("","_blank");w.document.write(html);w.document.close();w.focus();}

  // ── Export historical stats as styled HTML report ─────────────
  function exportHistoricalHTML(histYears, currInvestors, currCompanies, currMeetings){
    const invKey = inv => {
      const e=(inv.email||"").trim().toLowerCase();
      return e?"email:"+e:"name:"+(normalizeFund(inv.name||"")+"|||"+normalizeFund(inv.fund||""));
    };
    const currentYearLabel = "Actual";
    const allDatasets = [
      ...histYears,
      {year:currentYearLabel, investors:currInvestors.map(inv=>({name:inv.name,fund:inv.fund,email:(inv.email||"").toLowerCase().trim(),companies:inv.companies||[]}))}
    ].sort((a,b)=>a.year===currentYearLabel?1:b.year===currentYearLabel?-1:a.year.localeCompare(b.year));
    const allYears = allDatasets.map(y=>y.year);

    const yearKeySets = {};
    allDatasets.forEach(({year,investors:invs})=>{ yearKeySets[year]=new Set(invs.map(invKey)); });

    const invYearMap = {};
    allDatasets.forEach(({year,investors:invs})=>{
      invs.forEach(inv=>{const k=invKey(inv);if(!invYearMap[k])invYearMap[k]={info:inv,years:new Set()};invYearMap[k].years.add(year);});
    });

    const currentKeys = yearKeySets[currentYearLabel]||new Set();
    const maxTotal = Math.max(...allDatasets.map(d=>d.investors.length),1);

    // Per-year stats
    const yearStats = allDatasets.map(({year,investors:invs},i)=>{
      const prevYrs = allYears.slice(0,i);
      const prevKeys = new Set(prevYrs.flatMap(y=>[...yearKeySets[y]]));
      const myKeys = [...yearKeySets[year]];
      const returning = myKeys.filter(k=>prevKeys.has(k)).length;
      return {year, total:invs.length, returning, newCount:invs.length-returning, isAct:year===currentYearLabel};
    });

    // Missing from current
    const missing = Object.values(invYearMap).filter(v=>!v.years.has(currentYearLabel)&&v.years.size>0).sort((a,b)=>b.years.size-a.years.size);
    const returning = Object.values(invYearMap).filter(v=>v.years.has(currentYearLabel)&&v.years.size>1).sort((a,b)=>b.years.size-a.years.size);

    // Company demand
    const coDemand = {};
    COMPANIES_INIT.forEach(c=>{coDemand[c.id]={};});
    allDatasets.forEach(({year,investors:invs})=>{
      invs.forEach(inv=>{(inv.companies||[]).forEach(cid=>{if(coDemand[cid])coDemand[cid][year]=(coDemand[cid][year]||0)+1;});});
    });
    const coTotals = COMPANIES_INIT.map(c=>({...c,total:allYears.reduce((s,yr)=>s+(coDemand[c.id][yr]||0),0)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total).slice(0,14);
    const maxCo = Math.max(...coTotals.map(c=>c.total),1);

    const COLORS=["#9b59b6","#e67e22","#3399ff","#23a29e","#1e5ab0","#3a8c5c"];
    const BH=28,BG=8,LW=100;

    // Build participation SVG
    const svgH = yearStats.length*(BH+BG)+30;
    const partSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 ${svgH}" style="width:100%;max-width:500px">
      ${yearStats.map(({year,total,returning:ret,newCount,isAct},i)=>{
        const retW=(ret/maxTotal)*290; const newW=(newCount/maxTotal)*290;
        const y=i*(BH+BG);
        return `<text x="${LW-6}" y="${y+BH/2+5}" text-anchor="end" font-size="12" fill="${isAct?"#c9a227":"#7a8fa8"}" font-family="Helvetica,Arial,sans-serif" font-weight="${isAct?"bold":"normal"}">${isAct?"Actual":year}</text>
        <rect x="${LW}" y="${y}" width="${newW||2}" height="${BH}" rx="4" fill="${isAct?"#3399ff":"#4a6a9c"}" opacity="0.85"/>
        <rect x="${LW+newW}" y="${y}" width="${retW||0}" height="${BH}" rx="4" fill="#23a29e" opacity="0.8"/>
        <text x="${LW+newW+retW+8}" y="${y+BH/2+5}" font-size="12" fill="${isAct?"#c9a227":"#2d3f5e"}" font-family="Helvetica,Arial,sans-serif" font-weight="bold">${total}</text>`;
      }).join("")}
      <g transform="translate(${LW},${yearStats.length*(BH+BG)+8})">
        <rect width="12" height="12" rx="2" fill="#4a6a9c" opacity="0.85"/><text x="16" y="10" font-size="10" fill="#7a8fa8" font-family="Helvetica">Nuevos</text>
        <rect x="70" width="12" height="12" rx="2" fill="#23a29e" opacity="0.8"/><text x="86" y="10" font-size="10" fill="#7a8fa8" font-family="Helvetica">Volvieron</text>
      </g>
    </svg>`;

    // Retention SVG
    const retPairs = histYears.map(({year,investors:invs})=>{
      const prevKeys2=new Set(invs.map(invKey));
      const ret=[...currentKeys].filter(k=>prevKeys2.has(k)).length;
      const pct=invs.length>0?Math.round(ret/invs.length*100):0;
      return {year,ret,total:invs.length,pct};
    }).sort((a,b)=>a.year.localeCompare(b.year));
    const retSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 ${retPairs.length*(BH+BG)+30}" style="width:100%;max-width:400px">
      ${retPairs.map(({year,ret,total,pct},i)=>{
        const bw=(pct/100)*240; const y=i*(BH+BG);
        const col=pct>=50?"#3a8c5c":pct>=25?"#e67e22":"#e74c3c";
        return `<text x="88" y="${y+BH/2+5}" text-anchor="end" font-size="12" fill="#7a8fa8" font-family="Helvetica">${year} →</text>
        <rect x="92" y="${y}" width="${bw||2}" height="${BH}" rx="4" fill="${col}" opacity="0.85"/>
        <text x="${92+bw+8}" y="${y+BH/2+5}" font-size="13" fill="${col}" font-family="Helvetica" font-weight="bold">${pct}%</text>
        <text x="${92+bw+46}" y="${y+BH/2+5}" font-size="11" fill="#7a8fa8" font-family="Helvetica">(${ret}/${total})</text>`;
      }).join("")}
      <text x="92" y="${retPairs.length*(BH+BG)+18}" font-size="10" fill="#7a8fa8" font-family="Helvetica">volvieron al año actual</text>
    </svg>`;

    // Company bar SVG
    const coSvgH = coTotals.length*(BH+BG)+24;
    const coSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 ${coSvgH}" style="width:100%;max-width:620px">
      <g transform="translate(120,0)">${allYears.map((yr,i)=>`<g transform="translate(${i*52},0)"><rect width="12" height="12" rx="2" fill="${COLORS[i%COLORS.length]}" opacity="0.85"/><text x="15" y="10" font-size="10" fill="#7a8fa8" font-family="Helvetica">${yr==="Actual"?"Actual":yr}</text></g>`).join("")}</g>
      ${coTotals.map((co,ri)=>{
        const y=ri*(BH+BG)+18; let xOff=120;
        return `<text x="114" y="${y+BH/2+5}" text-anchor="end" font-size="11" fill="#2d3f5e" font-family="Helvetica" font-weight="bold">${co.ticker}</text>
        ${allYears.map((yr,yi)=>{
          const val=coDemand[co.id][yr]||0;
          const w=(val/maxCo)*280/allYears.length*0.85;
          const x=xOff; xOff+=280/allYears.length;
          return val>0?`<rect x="${x}" y="${y}" width="${w}" height="${BH*0.7}" rx="2" fill="${COLORS[yi%COLORS.length]}" opacity="0.8"/>${w>18?`<text x="${x+w+3}" y="${y+BH*0.7}" font-size="9" fill="#7a8fa8" font-family="Helvetica">${val}</text>`:""}`:""
        }).join("")}`;
      }).join("")}
    </svg>`;

    const now = new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"});

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Análisis Histórico — Latin Securities</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:Helvetica,Arial,sans-serif;background:#fff;color:#1a2a3a;padding:40px;}
  .logo{font-size:11px;text-transform:uppercase;letter-spacing:.15em;color:#1e5ab0;font-weight:700;margin-bottom:4px;}
  h1{font-size:24px;font-weight:700;color:#000039;margin-bottom:4px;}
  .date{font-size:12px;color:#7a8fa8;margin-bottom:32px;}
  h2{font-size:14px;font-weight:700;color:#000039;text-transform:uppercase;letter-spacing:.08em;margin:28px 0 12px;padding-bottom:6px;border-bottom:2px solid #3399ff;}
  .stats-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px;}
  .stat-box{background:#f5f8ff;border:1px solid #d0e0f0;border-radius:8px;padding:14px 18px;min-width:110px;text-align:center;}
  .stat-box.act{border-color:#3399ff;background:#eaf1fb;}
  .stat-v{font-size:28px;font-weight:700;color:#000039;}
  .stat-v.act{color:#1e5ab0;}
  .stat-l{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7a8fa8;margin-top:4px;}
  .stat-sub{font-size:10px;color:#3a8c5c;margin-top:2px;}
  .stat-sub.red{color:#e74c3c;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px;}
  .card{background:#fafcff;border:1px solid #e0eaf5;border-radius:10px;padding:18px;}
  .card h3{font-size:12px;font-weight:700;color:#1e5ab0;text-transform:uppercase;letter-spacing:.07em;margin-bottom:14px;}
  table{width:100%;border-collapse:collapse;font-size:11px;}
  th{background:#000039;color:#fff;padding:7px 10px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;}
  td{padding:6px 10px;border-bottom:1px solid #e8eef5;vertical-align:top;}
  tr:nth-child(even) td{background:#f4f8fc;}
  .badge{display:inline-block;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:700;background:#d0e8ff;color:#1e5ab0;margin:1px 2px;}
  .badge.gold{background:#fdf0d0;color:#c9a227;}
  .tag{display:inline-block;background:#eaf1fb;color:#1e5ab0;border-radius:4px;padding:2px 8px;font-size:10px;margin:2px 3px;}
  .footer{margin-top:48px;padding-top:16px;border-top:1px solid #d0e0f0;font-size:10px;color:#7a8fa8;display:flex;justify-content:space-between;}
  @media print{body{padding:20px;} .no-print{display:none;}}
</style></head><body>
  <div class="logo">Latin Securities</div>
  <h1>Análisis Histórico de Conferencias</h1>
  <div class="date">Generado el ${now}</div>

  <h2>Resumen de Participación</h2>
  <div class="stats-row">
    ${yearStats.map(({year,total,returning:ret,newCount,isAct})=>`
    <div class="stat-box ${isAct?"act":""}">
      <div class="stat-v ${isAct?"act":""}">${total}</div>
      <div class="stat-l">${isAct?"Actual ("+new Date().getFullYear()+")":year}</div>
      ${ret>0?`<div class="stat-sub">↩ ${ret} volvieron</div>`:""}
      ${isAct&&returning.length>0?`<div class="stat-sub">✓ ${returning.length} históricos</div>`:""}
    </div>`).join("")}
    <div class="stat-box">
      <div class="stat-v">${Object.keys(invYearMap).length}</div>
      <div class="stat-l">Total histórico</div>
    </div>
    <div class="stat-box" style="border-color:#e74c3c;background:#fff5f5">
      <div class="stat-v" style="color:#e74c3c">${missing.length}</div>
      <div class="stat-l">No volvieron</div>
    </div>
  </div>

  <div class="grid2">
    <div class="card"><h3>👥 Participación por edición</h3>${partSVG}</div>
    <div class="card"><h3>🔄 % que vuelve al año actual</h3>${retPairs.length>0?retSVG:"<p style='color:#7a8fa8;font-size:12px'>Cargá años anteriores para ver retención.</p>"}</div>
  </div>

  <h2>Demanda por Compañía</h2>
  <div class="card">${coSVG}</div>

  <h2>🏢 Tendencia por compañía</h2>
  <table>
    <thead><tr><th>Compañía</th>${allYears.map(yr=>`<th>${yr==="Actual"?"Actual":yr}</th>`).join("")}<th>Total</th></tr></thead>
    <tbody>
      ${coTotals.map(co=>{
        const vals=allYears.map(yr=>coDemand[co.id][yr]||0);
        const last=vals[vals.length-1],prev=vals.length>1?vals[vals.length-2]:null;
        const trend=prev===null?"":last>prev?"📈":last<prev?"📉":"➡";
        return `<tr><td><strong>${co.ticker}</strong> <span style="color:#7a8fa8;font-size:10px">${co.name}</span></td>
          ${vals.map((v,i)=>`<td style="text-align:center;font-weight:${allYears[i]==="Actual"?"bold":"400"};color:${allYears[i]==="Actual"?"#1e5ab0":"#1a2a3a"}">${v||"—"}</td>`).join("")}
          <td style="text-align:center;font-weight:700;color:#c9a227">${co.total} ${trend}</td></tr>`;
      }).join("")}
    </tbody>
  </table>

  ${returning.length>0?`
  <h2>🏆 Inversores que volvieron (${returning.length})</h2>
  <table>
    <thead><tr><th>#</th><th>Nombre</th><th>Fondo</th><th>Email</th><th>Ediciones</th></tr></thead>
    <tbody>${returning.slice(0,30).map(({info,years},i)=>`
      <tr><td>${i+1}</td><td><strong>${info.name}</strong></td><td style="color:#7a8fa8">${info.fund||"—"}</td>
      <td style="font-size:10px;color:#7a8fa8">${info.email||"—"}</td>
      <td>${[...years].sort().map(yr=>`<span class="badge ${yr==="Actual"?"gold":""}">${yr==="Actual"?"Actual":yr}</span>`).join("")}</td></tr>`).join("")}
    </tbody>
  </table>`:""}

  ${missing.length>0?`
  <h2>⚠️ Inversores que no volvieron (${missing.length})</h2>
  <table>
    <thead><tr><th>#</th><th>Nombre</th><th>Fondo</th><th>Email</th><th>Estuvo en</th></tr></thead>
    <tbody>${missing.slice(0,50).map(({info,years},i)=>`
      <tr><td>${i+1}</td><td><strong>${info.name}</strong></td><td style="color:#7a8fa8">${info.fund||"—"}</td>
      <td style="font-size:10px;color:#7a8fa8">${info.email||"—"}</td>
      <td>${[...years].sort().map(yr=>`<span class="badge">${yr}</span>`).join("")}</td></tr>`).join("")}
    </tbody>
  </table>`:""}

  <div class="footer">
    <span>Latin Securities — Análisis Histórico de Conferencias</span>
    <span>Generado el ${now}</span>
  </div>
</body></html>`;

    downloadBlob("HistoricoConferencias_LatinSecurities.html", new Blob([html],{type:"text/html;charset=utf-8"}), "text/html");
  }

  // ── Excel export with LS brand colors ────────────────────────
  function exportExcel(){
    // LS Brand palette from Visual Identity Guidelines
    const LS_NAVY   = "00000039";
    const LS_BLUE   = "003399ff";
    const LS_BLUE2  = "001e5ab0";
    const LS_TEAL   = "0023a29e";
    const LS_GOLD   = "00c9a227";
    const WHITE     = "00FFFFFF";
    const LIGHT_BG  = "00EAF1FB"; // soft blue tint for alternating rows
    const TEAL_LIGHT= "00E0F4F3";

    const wb = XLSX.utils.book_new();

    // Helper: set column widths
    const setCols = (ws, widths) => { ws['!cols'] = widths.map(w=>({wch:w})); };

    // Helper: style a cell
    const styleCell = (ws, addr, style) => {
      if(!ws[addr]) ws[addr] = {v:"", t:"s"};
      ws[addr].s = style;
    };

    const headerStyle = (bg=LS_NAVY) => ({
      fill:{patternType:"solid", fgColor:{rgb:bg}},
      font:{bold:true, color:{rgb:WHITE}, sz:10, name:"Calibri"},
      alignment:{horizontal:"center", vertical:"center", wrapText:true},
      border:{bottom:{style:"medium",color:{rgb:LS_BLUE}}}
    });
    const titleStyle = {
      fill:{patternType:"solid", fgColor:{rgb:LS_NAVY}},
      font:{bold:true, color:{rgb:"00C9A227"}, sz:13, name:"Calibri"},
      alignment:{horizontal:"left", vertical:"center"}
    };
    const subStyle = {
      fill:{patternType:"solid", fgColor:{rgb:LS_BLUE2}},
      font:{bold:true, color:{rgb:WHITE}, sz:10, name:"Calibri"},
      alignment:{horizontal:"left", vertical:"center"}
    };
    const rowStyle = (even, highlight=false) => ({
      fill:{patternType:"solid", fgColor:{rgb: highlight ? TEAL_LIGHT : (even ? LIGHT_BG : WHITE)}},
      font:{color:{rgb:"00000039"}, sz:9, name:"Calibri"},
      alignment:{vertical:"center", wrapText:true},
      border:{bottom:{style:"thin",color:{rgb:"00CCDDEE"}}}
    });
    const boldCell = (even) => ({...rowStyle(even), font:{bold:true, color:{rgb:LS_NAVY}, sz:9, name:"Calibri"}});

    const getDays = () => (config.days||DEFAULT_DAYS);

    // ── Sheet 1: Full Schedule (all meetings, sorted by time) ──────
    {
      const rows = [];
      const headerRow = ["Día","Hora","Compañía","Sector","Inversor","Fondo","Tipo","Sala"];
      rows.push(headerRow);
      const sorted = [...meetings].sort((a,b)=>{
        const di = getDays().findIndex(d=>d.id===a.day) - getDays().findIndex(d=>d.id===b.day);
        if(di!==0) return di;
        return (a.slot||"").localeCompare(b.slot||"");
      });
      sorted.forEach(m=>{
        const co = coById.get(m.coId);
        const invs = (m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);
        const day = getDays().find(d=>d.id===m.day);
        const mFundsX=new Set(invs.map(i=>i.fund||i.id).filter(Boolean));const mType = mFundsX.size<=1?"1x1":"Group";
        if(invs.length===0){
          rows.push([day?.long||m.day, m.slot, co?.name||m.coId, co?.sector||"", "—","—",mType,m.room||""]);
        } else {
          invs.forEach((inv,i)=>{
            rows.push([i===0?day?.long||m.day:"", i===0?m.slot:"", i===0?co?.name||m.coId:"", i===0?co?.sector||"":"", inv.name, inv.fund||"", i===0?mType:"", i===0?m.room||"":""]);
          });
        }
      });
      // Add dinners
      (config.dinners||[]).forEach(d=>{
        const day = getDays().find(dy=>dy.id===d.day);
        rows.push([day?.long||d.day, d.time||"", d.name, "Event", d.restaurant||"","","Event",d.address||""]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);
      setCols(ws,[14,9,22,12,22,22,9,10]);
      ws['!rows'] = [{hpt:22},...rows.slice(1).map(()=>({hpt:18}))];
      // Title row (insert before)
      XLSX.utils.sheet_add_aoa(ws,[["ARGENTINA IN NEW YORK 2026 — AGENDA COMPLETA"]],{origin:"A1",sheetStubs:true});
      // Style header
      headerRow.forEach((_,ci)=>{
        const addr = XLSX.utils.encode_cell({r:1,c:ci});
        styleCell(ws, addr, headerStyle());
      });
      // Style data rows
      for(let r=2;r<rows.length;r++){
        const isEven = r%2===0;
        const isEvent = rows[r][3]==="Event";
        for(let c=0;c<8;c++){
          const addr = XLSX.utils.encode_cell({r:r+1,c});
          if(!ws[addr]) ws[addr]={v:"",t:"s"};
          ws[addr].s = c===0||c===1||c===2 ? boldCell(isEven) : rowStyle(isEven, isEvent);
        }
      }
      ws['!merges'] = [{s:{r:0,c:0},e:{r:0,c:7}}];
      styleCell(ws,"A1",titleStyle);
      XLSX.utils.book_append_sheet(wb, ws, "Agenda Completa");
    }

    // ── Sheet 2: Por Compañía ──────────────────────────────────────
    {
      const aoa = [["ARGENTINA IN NEW YORK 2026 — POR COMPAÑÍA"]];
      let rowIdx = 1;
      const merges = [{s:{r:0,c:0},e:{r:0,c:5}}];
      const styleMap = {};
      styleMap["0:0"] = titleStyle;

      const coList = companies.filter(c=>meetings.some(m=>m.coId===c.id));
      coList.forEach(co=>{
        const coMtgs = meetings.filter(m=>m.coId===co.id).sort((a,b)=>{
          const di=getDays().findIndex(d=>d.id===a.day)-getDays().findIndex(d=>d.id===b.day);
          return di!==0?di:(a.slot||"").localeCompare(b.slot||"");
        });
        aoa.push([co.name+" ("+co.ticker+")", "", "", "", "", ""]);
        merges.push({s:{r:rowIdx,c:0},e:{r:rowIdx,c:5}});
        styleMap[rowIdx+":0"] = subStyle;
        rowIdx++;

        aoa.push(["Día","Hora","Inversor","Fondo","Tipo","Sala"]);
        styleMap[rowIdx+":0"]=headerStyle(LS_BLUE2);
        styleMap[rowIdx+":1"]=headerStyle(LS_BLUE2);
        styleMap[rowIdx+":2"]=headerStyle(LS_BLUE2);
        styleMap[rowIdx+":3"]=headerStyle(LS_BLUE2);
        styleMap[rowIdx+":4"]=headerStyle(LS_BLUE2);
        styleMap[rowIdx+":5"]=headerStyle(LS_BLUE2);
        rowIdx++;

        coMtgs.forEach((m,mi)=>{
          const invs=(m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);
          const day=getDays().find(d=>d.id===m.day);
          const mFundsY=new Set(invs.map(i=>i.fund||i.id).filter(Boolean));const mType=mFundsY.size<=1?"1x1":"Group";
          if(invs.length===0){
            aoa.push([day?.long||m.day,m.slot,"—","",mType,m.room||""]);
            for(let c=0;c<6;c++) styleMap[rowIdx+":"+c]=rowStyle(mi%2===0);
            rowIdx++;
          } else {
            invs.forEach((inv,ii)=>{
              aoa.push([ii===0?day?.long||m.day:"",ii===0?m.slot:"",inv.name,inv.fund||"",ii===0?mType:"",ii===0?m.room||"":""]);
              for(let c=0;c<6;c++) styleMap[rowIdx+":"+c]=(c<2?boldCell(mi%2===0):rowStyle(mi%2===0));
              rowIdx++;
            });
          }
        });
        aoa.push(["",""," ","","",""]);
        rowIdx++;
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      setCols(ws,[16,9,24,22,9,10]);
      ws['!merges'] = merges;
      Object.entries(styleMap).forEach(([key,style])=>{
        const [r,c]=key.split(":").map(Number);
        const addr=XLSX.utils.encode_cell({r,c});
        if(!ws[addr]) ws[addr]={v:"",t:"s"};
        ws[addr].s=style;
      });
      XLSX.utils.book_append_sheet(wb, ws, "Por Compañía");
    }

    // ── Sheet 3: Por Inversor ─────────────────────────────────────
    {
      const aoa = [["ARGENTINA IN NEW YORK 2026 — POR INVERSOR"]];
      let rowIdx = 1;
      const merges = [{s:{r:0,c:0},e:{r:0,c:4}}];
      const styleMap = {"0:0":titleStyle};

      const invList = investors.filter(inv=>meetings.some(m=>(m.invIds||[]).includes(inv.id)));
      invList.forEach(inv=>{
        const invMtgs = meetings.filter(m=>(m.invIds||[]).includes(inv.id)).sort((a,b)=>{
          const di=getDays().findIndex(d=>d.id===a.day)-getDays().findIndex(d=>d.id===b.day);
          return di!==0?di:(a.slot||"").localeCompare(b.slot||"");
        });
        aoa.push([inv.name+(inv.fund?" — "+inv.fund:""), "","","",""]);
        merges.push({s:{r:rowIdx,c:0},e:{r:rowIdx,c:4}});
        styleMap[rowIdx+":0"]=subStyle; rowIdx++;

        aoa.push(["Día","Hora","Compañía","Tipo","Sala"]);
        for(let c=0;c<5;c++) styleMap[rowIdx+":"+c]=headerStyle(LS_BLUE2);
        rowIdx++;

        invMtgs.forEach((m,mi)=>{
          const co=coById.get(m.coId);
          const day=getDays().find(d=>d.id===m.day);
          const mInvsZ=(m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);const mFundsZ=new Set(mInvsZ.map(i=>i.fund||i.id).filter(Boolean));const mType=mFundsZ.size<=1?"1x1":"Group";
          aoa.push([day?.long||m.day,m.slot,co?.name||m.coId,mType,m.room||""]);
          for(let c=0;c<5;c++) styleMap[rowIdx+":"+c]=(c<2?boldCell(mi%2===0):rowStyle(mi%2===0));
          rowIdx++;
        });
        aoa.push([""]);
        rowIdx++;
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      setCols(ws,[14,9,26,9,10]);
      ws['!merges']=merges;
      Object.entries(styleMap).forEach(([key,style])=>{
        const [r,c]=key.split(":").map(Number);
        const addr=XLSX.utils.encode_cell({r,c});
        if(!ws[addr]) ws[addr]={v:"",t:"s"};
        ws[addr].s=style;
      });
      XLSX.utils.book_append_sheet(wb, ws, "Por Inversor");
    }

    // ── Sheet 4: Lista de Inversores ──────────────────────────────
    {
      const header = ["Nombre","Fondo","Email","Teléfono","Cargo","AUM","Reuniones Asignadas","Compañías Solicitadas"];
      const rows = [header, ...investors.map(inv=>{
        const nMtgs = meetings.filter(m=>(m.invIds||[]).includes(inv.id)).length;
        return [inv.name, inv.fund||"", inv.email||"", inv.phone||"", inv.position||"", inv.aum||"", nMtgs, (inv.companies||[]).map(cid=>{const co=coById.get(cid);return co?.ticker||cid;}).join(", ")];
      })];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      setCols(ws,[24,22,28,16,18,10,10,34]);
      ws['!rows']=[{hpt:22},...investors.map(()=>({hpt:16}))];
      header.forEach((_,ci)=>{
        const addr=XLSX.utils.encode_cell({r:0,c:ci});
        if(!ws[addr]) ws[addr]={v:"",t:"s"};
        ws[addr].s=headerStyle();
      });
      for(let r=1;r<rows.length;r++){
        const isEven=r%2===0;
        for(let c=0;c<8;c++){
          const addr=XLSX.utils.encode_cell({r,c});
          if(!ws[addr]) ws[addr]={v:"",t:"s"};
          ws[addr].s=(c===0?boldCell(isEven):rowStyle(isEven));
        }
      }
      XLSX.utils.book_append_sheet(wb, ws, "Inversores");
    }

    const wbout = XLSX.write(wb, {bookType:"xlsx", type:"array", cellStyles:true});
    downloadBlob("ArgentinaInNY2026_LatinSecurities.xlsx", new Blob([wbout],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }

  function exportInvestor(inv,format){
    const data=investorToEntity(inv,meetings,companies,config,investors); if(!data){alert("Sin reuniones.");return;}
    const fname=`${inv.fund||inv.name}_${inv.name}`.replace(/[^a-zA-Z0-9_\-]/g,"_").replace(/_+/g,"_");
    if(format==="word") downloadBlob(`${fname}.doc`,buildWordHTML(data.name,data.sub,data.sections,config),"application/msword");
    else openPrint(buildPrintHTML([data],config));
  }
  function exportCompany(co,format){
    const data=companyToEntity(co,meetings,investors,config); if(!data){alert("Sin reuniones.");return;}
    if(format==="word") downloadBlob(`${co.ticker}_schedule.doc`,buildWordHTML(data.name,data.sub,data.sections,config),"application/msword");
    else openPrint(buildPrintHTML([{...data,attendees:co.attendees}],config));
  }
  function saveRoadshow(rs){setRoadshow(rs);saveCurrentEvent({roadshow:rs});}
  function exportRoadshowPDF(){const e=rsToEntity(roadshow,roadshow.companies);if(!e){alert("Agregá reuniones al roadshow primero.");return;}const meta={...config,eventTitle:(roadshow.trip.fund||roadshow.trip.clientName||"Buenos Aires Roadshow"),eventType:"Latin Securities · Roadshow",eventDates:tripDays.length?`${new Date(tripDays[0]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${new Date(tripDays[tripDays.length-1]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`:"",venue:roadshow.trip.hotel};openPrint(buildPrintHTML([e],meta));}
  function exportRoadshowICS(){
    const ics=buildICS(roadshow.meetings,roadshow.companies,roadshow.trip);
    const fn=`Roadshow_${(roadshow.trip.fund||roadshow.trip.clientName||"BA").replace(/[^a-zA-Z0-9]/g,"_")}.ics`;
    downloadBlob(fn,ics,"text/calendar;charset=utf-8");
  }
  function exportBookingPage(){
    const html=buildBookingPage(roadshow.trip,roadshow.companies,roadshow.meetings,roadshow.trip.officeAddress);
    const fn=`BookingPage_${(roadshow.trip.fund||roadshow.trip.clientName||"Roadshow").replace(/[^a-zA-Z0-9]/g,"_")}.html`;
    downloadBlob(fn,html,"text/html");
  }
  function exportRoadshowWord(){const e=rsToEntity(roadshow,roadshow.companies);if(!e){alert("Agregá reuniones al roadshow primero.");return;}const fn=`Roadshow_${(roadshow.trip.fund||roadshow.trip.clientName||"BA").replace(/[^a-zA-Z0-9]/g,"_")}.doc`;downloadBlob(fn,buildWordHTML(e.name,e.sub,e.sections,{...config,eventTitle:roadshow.trip.fund||"Buenos Aires Roadshow"}),"application/msword");}
  function handleRsExcel(e){
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:"array"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
        if(rows.length<2){alert("El archivo no tiene datos.");return;}
        const hdr=rows[0].map(h=>String(h).toLowerCase().trim());
        const col=k=>hdr.findIndex(h=>h.includes(k));
        const nc=col("name"),tc=col("ticker"),sc=col("sector"),lc=col("location"),cc=col("contact"),ec=col("email"),pc=col("phone"),ac=col("address"),oc=col("notes");
        const newCos=rows.slice(1).filter(r=>r[nc]).map((r,i)=>({
          id:`rc_xl_${Date.now()}_${i}`,
          name:String(r[nc]||"").trim(),
          ticker:String(r[tc]||"").trim().toUpperCase(),
          sector:String(r[sc]||"Custom").trim(),
          location:String(r[lc]||"ls_office").trim().includes("hq")?"hq":"ls_office",
          locationCustom:String(r[ac]||"").trim(),
          contacts:[{id:`rep_${Date.now()}_${i}`,name:String(r[cc]||"").trim(),email:String(r[ec]||"").trim(),phone:String(r[pc]||"").trim(),title:""}].filter(c=>c.name),
          contact:{name:String(r[cc]||"").trim(),email:String(r[ec]||"").trim(),phone:String(r[pc]||"").trim()},
          notes:String(r[oc]||"").trim(),
          active:true
        }));
        if(!newCos.length){alert("No se encontraron empresas. Verificá que la columna se llame 'Name'.");return;}
        const merged=[...roadshow.companies,...newCos.filter(nc=>!roadshow.companies.some(ex=>ex.name.toLowerCase()===nc.name.toLowerCase()))];
        saveRoadshow({...roadshow,companies:merged});
        alert(`✅ ${newCos.length} empresa(s) importada(s). ${merged.length-roadshow.companies.length} nuevas.`);
      }catch(err){alert("Error leyendo el archivo: "+err.message);}
    };
    reader.readAsArrayBuffer(file);
    e.target.value="";
  }
  function handleRsEmailParse(text){
    // Extract dates
    const dateRe=/\b(\d{1,2})[\s/\-](\w+)[\s/\-,]+(\d{4})/g;
    const monthMap={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    const dates=[];let m;
    while((m=dateRe.exec(text.toLowerCase()))!==null){
      const d=parseInt(m[1]),mo=monthMap[m[2].toLowerCase().slice(0,3)]||parseInt(m[2]),y=parseInt(m[3]);
      if(mo&&d&&y) dates.push(`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
    }
    dates.sort();
    // Extract hotel
    const hotelM=text.match(/staying at ([\w\s]+(?:hotel|inn|hilton|hyatt|marriott|sheraton|intercontinental|four seasons|palacio|sofitel|faena)[\w\s]*)/i);
    const hotel=hotelM?hotelM[1].trim():"";
    // Extract company names by matching known tickers/names
    const knownCos=[
      {name:"Banco Macro",ticker:"BMA",id:"rc_bmacro",sector:"Financials"},
      {name:"BBVA Argentina",ticker:"BBAR",id:"rc_bbva",sector:"Financials"},
      {name:"Grupo Financiero Galicia",ticker:"GGAL",id:"rc_ggal",sector:"Financials"},
      {name:"Galicia",ticker:"GGAL",id:"rc_ggal",sector:"Financials"},
      {name:"Grupo Supervielle",ticker:"SUPV",id:"rc_supv",sector:"Financials"},
      {name:"Supervielle",ticker:"SUPV",id:"rc_supv",sector:"Financials"},
      {name:"BYMA",ticker:"BYMA",id:"rc_byma",sector:"Exchange"},
      {name:"Pampa",ticker:"PAMP",id:"rc_pampa",sector:"Energy"},
      {name:"Pampa Energía",ticker:"PAMP",id:"rc_pampa",sector:"Energy"},
      {name:"YPF",ticker:"YPFD",id:"rc_ypf",sector:"Energy"},
      {name:"Vista",ticker:"VIST",id:"rc_vista",sector:"Energy"},
      {name:"Vista Energy",ticker:"VIST",id:"rc_vista",sector:"Energy"},
      {name:"Central Puerto",ticker:"CEPU",id:"rc_cepu",sector:"Energy"},
      {name:"Transportadora de Gas del Sur",ticker:"TGSU2",id:"rc_tgsu",sector:"Energy"},
      {name:"TGS",ticker:"TGSU2",id:"rc_tgsu",sector:"Energy"},
      {name:"TGN",ticker:"TGNO4",id:"rc_tgn",sector:"Energy"},
      {name:"Telecom",ticker:"TECO2",id:"rc_teco",sector:"TMT"},
      {name:"Telecom Argentina",ticker:"TECO2",id:"rc_teco",sector:"TMT"},
      {name:"Loma Negra",ticker:"LOMA",id:"rc_loma",sector:"Industry"},
      {name:"Edenor",ticker:"EDN",id:"rc_edn",sector:"Energy"},
      {name:"Globant",ticker:"GLOB",id:"rc_glob",sector:"TMT"},
    ];
    const lower=text.toLowerCase();
    const matched=[];const seenIds=new Set();
    for(const co of knownCos){
      if(lower.includes(co.name.toLowerCase())&&!seenIds.has(co.id)){
        seenIds.add(co.id);
        const existing=roadshow.companies.find(c=>c.id===co.id||c.name.toLowerCase()===co.name.toLowerCase());
        if(!existing) matched.push({id:co.id+"_"+Date.now(),name:co.name,ticker:co.ticker,sector:co.sector,location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true});
      }
    }
    // Any unknown company lines (lines with just company names)
    const lines=text.split("\n").map(l=>l.trim()).filter(l=>l.length>3&&l.length<60&&!/[.:@]/.test(l)&&!/^(we|i|please|below|let|both|and|on|leaving|arriving|staying|would|like|meet|your)/i.test(l));
    const patchTrip={};
    if(dates.length>=2){patchTrip.arrivalDate=dates[0];patchTrip.departureDate=dates[dates.length-1];}
    if(hotel) patchTrip.hotel=hotel;
    return{patchTrip,matchedCos:matched};
  }
  function handleRsMeetingsExcel(e){
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:"array"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
        // Smart header detection: find the row that has AT LEAST 3 column-like keywords
        // This avoids false positives from subtitle rows like "agenda de compañías"
        const COL_KEYS=["fecha","date","hora","hour","time","compañ","company","empresa",
                        "tipo","type","direc","location","lugar","estado","status","notas","notes"];
        let hdrRowIdx=0;
        for(let i=0;i<Math.min(rows.length,6);i++){
          const rowStr=rows[i].map(c=>String(c||"").toLowerCase());
          const hits=rowStr.filter(cell=>COL_KEYS.some(k=>cell.includes(k))).length;
          if(hits>=3){hdrRowIdx=i;break;}
        }
        const dataRows=rows.slice(hdrRowIdx+1).filter(r=>r.some(c=>String(c||"").trim()));
        if(!dataRows.length){alert("Archivo vacío o sin filas de datos.");return;}
        const hdr=rows[hdrRowIdx].map(h=>String(h||"").toLowerCase().trim());
        // Flexible column matching — accepts Spanish OR English headers
        const ci=(...keys)=>{const idx=hdr.findIndex(h=>keys.some(k=>h.includes(k)));return idx;};
        const datC  = ci("fecha","date");
        const diaC  = ci("día","dia","day");
        const hourC = ci("hora","hour","time");
        const coC   = ci("compañía","compania","company","empresa");
        const typeC = ci("tipo","type");
        const locC  = ci("dirección","direccion","location","lugar","address");
        const statC = ci("estado","status");
        const notesC= ci("notas","notes","nota");

        const rsCoMap=new Map(roadshow.companies.map(c=>[c.name.toLowerCase(),c]));
        const newMtgs=[];let skipped=0;
        dataRows.forEach((r,i)=>{
          const rawDate=String(r[datC]||"").trim();
          const rawHour=String(r[hourC>=0?hourC:2]||"").trim();
          if(!rawDate||rawDate==="Fecha"||rawDate==="Date") return; // skip re-header rows
          // Parse date — DD/MM/YYYY, YYYY-MM-DD, or Excel serial
          let dateStr="";
          if(/^\d{5}$/.test(rawDate)){
            const d=new Date(Math.round((parseFloat(rawDate)-25569)*86400*1000));
            dateStr=d.toISOString().slice(0,10);
          } else if(/\d{4}-\d{2}-\d{2}/.test(rawDate)){
            dateStr=rawDate.slice(0,10);
          } else if(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/.test(rawDate)){
            const m=rawDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
            const y=m[3].length===2?"20"+m[3]:m[3];
            dateStr=`${y}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
          } else { skipped++; return; }
          // Parse hour — handles ALL Excel formats:
          // - Excel time fraction: 0.375 = 9:00, 0.5 = 12:00, 0.625 = 15:00
          // - String: "09:00", "9:00", "15:00", "9", "15", "3pm", "3 PM"
          // - Smart 12h: if hour < 8 → assume PM (add 12). No meetings at 3am.
          let hour=9;
          const numVal=parseFloat(rawHour);
          if(!isNaN(numVal)&&numVal>0&&numVal<1){
            // Excel time fraction (e.g. 0.375 = 9:00)
            hour=Math.round(numVal*24);
          } else {
            const pmMatch=rawHour.match(/pm/i);
            const amMatch=rawHour.match(/am/i);
            const hMatch=rawHour.match(/(\d{1,2})(?:[:h\.,](\d{0,2}))?/);
            if(hMatch){
              hour=parseInt(hMatch[1]);
              if(pmMatch&&hour<12) hour+=12;
              else if(amMatch&&hour===12) hour=0;
              else if(!pmMatch&&!amMatch&&hour<8) hour+=12; // 3:00 → 15:00
            }
          }
          hour=Math.max(7,Math.min(20,hour)); // clamp to 7am-8pm
          // Match company against roadshow companies list
          const rawCoName=coC>=0?String(r[coC]||"").trim():"";
          const rawCoLow=rawCoName.toLowerCase();
          const co=rawCoLow?([...rsCoMap.entries()].find(([k])=>k.includes(rawCoLow)||rawCoLow.includes(k))||[])[1]:null;
          // Type: "Company Visit" → company, anything with "internal/ls/almuerzo/lunch" → ls_internal
          const typeRaw=typeC>=0?String(r[typeC]||"").toLowerCase():"company";
          const type=typeRaw.includes("internal")||typeRaw.includes("intern")||typeRaw.includes("ls")||typeRaw.includes("almuerzo")||typeRaw.includes("lunch")||typeRaw.includes("network")?"ls_internal":"company";
          // Location: if it contains a street address, store as custom; "hq" → hq; otherwise ls_office
          const locRaw=locC>=0?String(r[locC]||"").trim():"";
          const locLow=locRaw.toLowerCase();
          let loc="ls_office", locCustom="";
          if(locLow.includes("hq")||locLow.includes("headquarters")) loc="hq";
          else if(locLow.includes("latin securities")||locLow.includes("arenales")||locLow.includes("ls office")||locLow.includes("oficina latin")) loc="ls_office";
          else if(locRaw.length>4){ loc="custom"; locCustom=locRaw; } // real address → custom
          // Status: "✅ Confirmado" / "confirmed" / "tentativo" etc.
          const statRaw=statC>=0?String(r[statC]||"tentative").toLowerCase():"tentative";
          const status=statRaw.includes("confirm")||statRaw.includes("✅")?"confirmed":statRaw.includes("cancel")||statRaw.includes("❌")?"cancelled":"tentative";
          const notes=notesC>=0?String(r[notesC]||"").trim():"";
          newMtgs.push({
            id:`rsm-xl-${Date.now()}-${i}`,
            date:dateStr, hour, duration:60, type,
            companyId:co?.id||"", title:!co?rawCoName:"",
            location:loc, locationCustom:locCustom, status, notes,
            attendeeIds:[]
          });
        });
        if(!newMtgs.length){alert("No se pudieron importar reuniones. Revisá el formato."+(skipped?" ("+skipped+" filas sin fecha)":""));return;}
        // Find companies that already have meetings
        const existingCos=new Set(roadshow.meetings.filter(m=>m.companyId).map(m=>m.companyId));
        const newCosInFile=new Set(newMtgs.filter(m=>m.companyId).map(m=>m.companyId));
        const overlap=[...newCosInFile].filter(id=>existingCos.has(id));
        let finalMeetings=[...roadshow.meetings];
        let replaced=0, added=0, skippedConflict=0;
        if(overlap.length>0){
          const coNames=overlap.map(id=>{const c=roadshow.companies.find(x=>x.id===id);return c?c.name:id;});
          const doReplace=confirm(`Las siguientes compañías ya tienen reuniones:\n\n${coNames.join("\n")}\n\n¿Reemplazar con las reuniones del Excel? (las existentes se borrarán)\n\nCancelar = solo agregar las nuevas sin borrar nada.`);
          if(doReplace){
            // Remove existing meetings for those companies
            finalMeetings=finalMeetings.filter(m=>!overlap.includes(m.companyId));
            replaced=overlap.length;
          }
        }
        // Add new meetings — skip time conflicts only for non-replaced slots
        newMtgs.forEach(nm=>{
          const conflict=finalMeetings.some(ex=>ex.date===nm.date&&ex.hour===nm.hour);
          if(conflict) skippedConflict++;
          else { finalMeetings.push(nm); added++; }
        });
        saveRoadshow({...roadshow,meetings:finalMeetings});
        const msg=[
          `✅ ${added} reunión(es) importada(s).`,
          replaced?`${replaced} compañía(s) reemplazadas.`:"",
          skipped?`${skipped} filas sin fecha ignoradas.`:"",
          skippedConflict?`${skippedConflict} omitidas por conflicto de horario.`:"",
        ].filter(Boolean).join(" ");
        alert(msg);
      }catch(err){alert("Error leyendo el archivo: "+err.message);}
    };
    reader.readAsArrayBuffer(file);
    e.target.value="";
  }
  // ─── Global DB: Excel import ──────────────────────────────────────
  function handleDBCompaniesExcel(e){
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:"array"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
        if(rows.length<2){alert("Archivo vacío.");return;}
        const hdr=rows[0].map(h=>String(h).toLowerCase().trim());
        const ci=k=>hdr.findIndex(h=>h.includes(k));
        const nc=ci("name"),tc=ci("ticker"),sc=ci("sector"),wc=ci("website"),ac=ci("address"),hc=ci("hq"),
          r1c=ci("contact 1"),e1c=ci("email 1"),p1c=ci("phone 1"),t1c=ci("title 1"),
          r2c=ci("contact 2"),e2c=ci("email 2"),p2c=ci("phone 2"),t2c=ci("title 2"),
          r3c=ci("contact 3"),e3c=ci("email 3"),p3c=ci("phone 3"),t3c=ci("title 3");
        const imported=[];
        rows.slice(1).filter(r=>r[nc]).forEach(r=>{
          const name=String(r[nc]).trim();
          const contacts=[];
          [[r1c,e1c,p1c,t1c],[r2c,e2c,p2c,t2c],[r3c,e3c,p3c,t3c]].forEach(([rc,ec,pc,tc])=>{
            if(rc>=0&&r[rc]) contacts.push({id:`rep_${Date.now()}_${Math.random().toString(36).slice(2)}`,name:String(r[rc]||"").trim(),email:String(r[ec>=0?ec:""]||"").trim(),phone:String(r[pc>=0?pc:""]||"").trim(),title:String(r[tc>=0?tc:""]||"").trim()});
          });
          imported.push({id:`dbc_${Date.now()}_${Math.random().toString(36).slice(2)}`,name,ticker:String(r[tc>=0?tc:""]||"").trim().toUpperCase(),sector:String(r[sc>=0?sc:""]||"Other").trim(),website:String(r[wc>=0?wc:""]||"").trim(),hqAddress:String(r[ac>=0?ac:hc>=0?hc:""]||"").trim(),contacts});
        });
        if(!imported.length){alert("No se encontraron compañías. Verificá que la primera columna sea 'Name'.");return;}
        const db={...globalDB};
        let added=0,updated=0;
        imported.forEach(ic=>{
          const idx=db.companies.findIndex(x=>x.name.toLowerCase()===ic.name.toLowerCase()||x.ticker===ic.ticker);
          if(idx>=0){
            // Merge contacts
            const existing=db.companies[idx];
            const newContacts=[...existing.contacts];
            ic.contacts.forEach(nc2=>{if(!newContacts.some(x=>x.email&&x.email===nc2.email))newContacts.push(nc2);});
            db.companies[idx]={...existing,...ic,contacts:newContacts};
            updated++;
          } else {db.companies.push(ic);added++;}
        });
        saveGlobalDB(db);
        alert(`✅ ${added} compañía(s) agregada(s), ${updated} actualizada(s).`);
      }catch(err){alert("Error: "+err.message);}
    };
    reader.readAsArrayBuffer(file);e.target.value="";
  }

  function handleDBInvestorsExcel(e){
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const wb=XLSX.read(ev.target.result,{type:"array"});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
        if(rows.length<2){alert("Archivo vacío.");return;}
        const hdr=rows[0].map(h=>String(h).toLowerCase().trim());
        const ci=k=>hdr.findIndex(h=>h.includes(k));
        const nc=ci("name"),fc=ci("fund"),pc=ci("position"),ec=ci("email"),phc=ci("phone"),
              ac=ci("aum"),cc=ci("companies"),lc=ci("linkedin"),slc=ci("slots"),notc=ci("notes");
        const imported=rows.slice(1).filter(r=>r[nc]).map(r=>({
          id:`dbi_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name:String(r[nc]||"").trim(),
          fund:String(r[fc>=0?fc:""]||"").trim(),
          position:String(r[pc>=0?pc:""]||"").trim(),
          email:String(r[ec>=0?ec:""]||"").trim().toLowerCase(),
          phone:String(r[phc>=0?phc:""]||"").trim(),
          aum:String(r[ac>=0?ac:""]||"").trim(),
          companies:String(r[cc>=0?cc:""]||"").split(";").map(s=>s.trim()).filter(Boolean),
          linkedin:String(r[lc>=0?lc:""]||"").trim(),
          notes:String(r[notc>=0?notc:""]||"").trim(),
        }));
        if(!imported.length){alert("No se encontraron inversores.");return;}
        const db={...globalDB};
        let added=0,updated=0;
        imported.forEach(ii=>{
          const idx=db.investors.findIndex(x=>(x.email&&x.email===ii.email)||(x.name.toLowerCase()===ii.name.toLowerCase()&&x.fund.toLowerCase()===ii.fund.toLowerCase()));
          if(idx>=0){db.investors[idx]={...db.investors[idx],...ii};updated++;}
          else{db.investors.push(ii);added++;}
        });
        saveGlobalDB(db);
        alert(`✅ ${added} inversor(es) agregado(s), ${updated} actualizado(s).`);
      }catch(err){alert("Error: "+err.message);}
    };
    reader.readAsArrayBuffer(file);e.target.value="";
  }

  function downloadDBTemplate(type){
    let ws,name;
    if(type==="companies"){
      ws=XLSX.utils.aoa_to_sheet([
        ["Name","Ticker","Sector","HQ Address","Contact 1","Title 1","Email 1","Phone 1 (opcional)","Contact 2","Title 2","Email 2","Phone 2 (opcional)","Contact 3","Title 3","Email 3","Phone 3 (opcional)"],
        ["Banco Macro","BMA","Financials","www.macro.com.ar","Av. Eduardo Madero 1182, CABA","Juan Pérez","IR Manager","jperez@macro.com.ar","+54 11 5222 6500","María López","CFO","mlopez@macro.com.ar","","","","",""],
        ["YPF","YPFD","Energy","www.ypf.com","Macacha Güemes 515, CABA","Carlos Rodríguez","Head of IR","crodriguez@ypf.com","+54 11 5441 2000","","","","","","","",""],
      ]);
      name="Plantilla_Compañías.xlsx";
    } else {
      ws=XLSX.utils.aoa_to_sheet([
        ["Name","Fund","Position","Email","Phone","AUM","Companies (separadas por ;)","LinkedIn","Notes"],
        ["John Smith","BlackRock","Portfolio Manager","john.smith@blackrock.com","+1 212 810 5000","$5B","YPF;Pampa;Galicia","linkedin.com/in/johnsmith","Focused on energy and financials"],
        ["María García","Templeton","Analyst","mgarcia@templeton.com","+1 650 312 2000","","Banco Macro;BBVA","",""],
      ]);
      name="Plantilla_Inversores.xlsx";
    }
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,type==="companies"?"Compañías":"Inversores");
    XLSX.writeFile(wb,name);
  }
  function saveMoverStocks(arr){setMoverStocks(arr);localStorage.setItem("ls_movers",JSON.stringify(arr));}
  async function fetchCCL(){
    setMoverCCLLoading(true);setMoverCCLErr(null);
    try{
      const r=await fetch("https://dolarapi.com/v1/dolares/contadoconliquidacion");
      if(!r.ok) throw new Error("HTTP "+r.status);
      const d=await r.json();
      setMoverCCL(d.venta||d.compra||null);
      setMoverCCLManual("");
    }catch(e){
      // fallback: argentinadatos
      try{
        const r2=await fetch("https://api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliquidacion");
        if(r2.ok){const d2=await r2.json();const last=Array.isArray(d2)?d2[d2.length-1]:d2;setMoverCCL(last?.venta||last?.cierre||null);setMoverCCLManual("");setMoverCCLLoading(false);return;}
      }catch{}
      setMoverCCLErr("No se pudo obtener el CCL automáticamente. Ingresalo manualmente.");
    }
    setMoverCCLLoading(false);
  }
  function exportMoverPrompt(){
    const ccl=parseFloat(moverCCLManual)||moverCCL;
    if(!moverStocks.length){alert("Agregá acciones primero.");return;}
    const sorted=[...moverStocks].sort((a,b)=>parseFloat(b.varPct||0)-parseFloat(a.varPct||0));
    const gainers=sorted.filter(s=>parseFloat(s.varPct||0)>0).slice(0,5);
    const losers=[...sorted].reverse().filter(s=>parseFloat(s.varPct||0)<0).slice(0,5);
    const fmtLine=(s)=>{
      const varUSD=ccl&&s.prev&&s.today?((s.today/s.prev-1)*100-(0)).toFixed(1):null;
      return `  ${s.ticker.padEnd(7)} | ${s.varPct>=0?"+":""}${parseFloat(s.varPct||0).toFixed(1)}% ARS${varUSD!==null?" | "+(varUSD>=0?"+":"")+varUSD+"% USD":""} | ${s.comment||"sin comentario"}`;
    };
    const prompt=`You are helping write the "Top Movers" section for the ${config.eventTitle||"LS"} conference daily summary.

CCL (Contado con liquidación): ${ccl?"$"+ccl+" ARS/USD":"no disponible"}
Fecha: ${new Date().toLocaleDateString("es-AR")}

TOP GAINERS (ARS):
${gainers.map(fmtLine).join("\n")||"  (ninguno)"}

TOP LOSERS (ARS):
${losers.map(fmtLine).join("\n")||"  (ninguno)"}

TODAS LAS ACCIONES:
${moverStocks.map(fmtLine).join("\n")}

Por favor escribí un párrafo de 3-4 oraciones para el "Top Movers" del daily summary institucional. Destacá:
- Las acciones más destacadas (suba y baja) con sus variaciones
- Si hay un patrón sectorial (bancos, energía, etc.)
- El contexto del tipo de cambio CCL si es relevante
- Tono profesional para inversores institucionales, en inglés

Formato:
Top Movers — [fecha]
[Párrafo aquí]`;
    navigator.clipboard.writeText(prompt).then(()=>alert("✅ Prompt copiado. Pegalo en Claude.")).catch(()=>{
      const w=window.open("","_blank","width=720,height=540");
      w.document.write("<pre style='font:13px monospace;padding:20px;'>"+prompt.replace(/</g,"&lt;")+"</pre>");w.document.close();
    });
  }
  function exportSummaryPrompt(dayId){
    const dayIds=getDayIds(config);
    const dayLong=getDayLong(config);
    const allSlots=makeSlots(config.hours,config);
    const dayMeetings=meetings.filter(m=>slotDay(m.slotId)===dayId).sort((a,b)=>allSlots.indexOf(a.slotId)-allSlots.indexOf(b.slotId));
    if(!dayMeetings.length){alert("No hay reuniones para ese día.");return;}
    const dayLabel=dayLong[dayId]||dayId;
    const lines=dayMeetings.map(m=>{
      const co=coById.get(m.coId);
      const invs=(m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);
      const funds=[...new Set(invs.map(i=>i.fund).filter(Boolean))];
      const isGroup=new Set(invs.map(i=>i.fund||i.id)).size>1;
      return `  - ${hourLabel(slotHour(m.slotId))} | ${co?.name||m.coId} (${co?.ticker||""}) | ${invs.map(i=>i.name).join(", ")} — ${funds.join(", ")} | ${isGroup?"Group Meeting":"1x1"} | ${m.room}`;
    });
    const coNames=[...new Set(dayMeetings.map(m=>coById.get(m.coId)?.name).filter(Boolean))];
    const prompt=`You are helping write the "Daily Summary Bar" for the ${config.eventTitle||"LS"} investor conference.

Below is the full agenda for ${dayLabel}:

${lines.join("\n")}

Total meetings: ${dayMeetings.length}
Companies presenting: ${coNames.join(", ")}

Please write a concise 2–3 sentence "Daily Summary" for this day suitable for the printed schedule header. The summary should:
- Highlight the key sectors or themes of the day
- Mention the total number of meetings
- Be professional and suitable for an institutional investor audience
- Be written in English

Format:
Daily Summary — ${dayLabel}
[Your 2–3 sentence summary here]`;
    navigator.clipboard.writeText(prompt).then(()=>alert("✅ Prompt copiado al portapapeles. Pegalo en Claude para generar el Daily Summary.")).catch(()=>{
      const w=window.open("","_blank","width=700,height=500");
      w.document.write("<pre style='font-family:monospace;padding:20px;font-size:13px;'>"+prompt.replace(/</g,"&lt;")+"</pre>");
      w.document.close();
    });
  }
  function exportAll(scope,format){
    if(!scheduled){alert("Generá la agenda primero.");return;}
    const entities=scope==="companies"
      ?companies.map(co=>companyToEntity(co,meetings,investors,config)).filter(Boolean)
      :investors.map(inv=>investorToEntity(inv,meetings,companies,config,investors)).filter(Boolean);
    if(!entities.length){alert("Sin datos.");return;}
    if(format==="pdf_combined"){openPrint(buildPrintHTML(entities,config));return;}
    const files=entities.map(e=>({name:`${e.name.replace(/[^a-zA-Z0-9\s]/g,"").replace(/\s+/g,"_").slice(0,40)}${format==="word"?".doc":".html"}`,data:format==="word"?buildWordHTML(e.name,e.sub,e.sections,config):buildPrintHTML([e],config)}));
    downloadBlob(`ArgentinaInNY2026_${scope==="companies"?"Companies":"Investors"}.zip`,buildZip(files),"application/zip");
  }

  // ── Derived ──────────────────────────────────────────────────
  // ── Index Maps: O(1) lookups instead of O(n) .find() on every render ──
  // Rule: vercel-react-best-practices/js-index-maps
  const invById=useMemo(()=>new Map(investors.map(i=>[i.id,i])),[investors]);
  const coById=useMemo(()=>new Map(companies.map(c=>[c.id,c])),[companies]);

  const byCompany=useMemo(()=>{
    const map={};companies.forEach(c=>{map[c.id]=[];});
    meetings.forEach(m=>map[m.coId]?.push(m));
    Object.values(map).forEach(arr=>arr.sort((a,b)=>allSlots.indexOf(a.slotId)-allSlots.indexOf(b.slotId)));
    return map;
  },[meetings,companies,allSlots]);

  const byInvestor=useMemo(()=>{
    const map={};investors.forEach(i=>{map[i.id]=[];});
    meetings.forEach(m=>(m.invIds||[]).forEach(id=>map[id]?.push(m)));
    Object.values(map).forEach(arr=>arr.sort((a,b)=>allSlots.indexOf(a.slotId)-allSlots.indexOf(b.slotId)));
    return map;
  },[meetings,investors,allSlots]);

  const activeCos=useMemo(()=>companies.filter(c=>investors.some(i=>(i.companies||[]).includes(c.id))),[companies,investors]);
  // Always show all active companies in grid — don't filter by meetings, that caused blank grid
  const dayCos=activeCos;

  // ── Combine multiple meetings.filter passes into one (js-combine-iterations) ──
  const meetingStats=useMemo(()=>{
    const dayIds=getDayIds(config);
    const counts={};dayIds.forEach(d=>{counts[d]=0;});
    let groupCount=0;
    for(const m of meetings){
      const d=slotDay(m.slotId);
      if(counts[d]!==undefined) counts[d]++;
      const invs=(m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);
      if(new Set(invs.map(i=>i.fund||i.id)).size>1) groupCount++;
    }
    return{counts,groupCount};
  },[meetings,config,invById]);

  // ── Roadshow derived ─────────────────────────────────────────────
  const tripDays=useMemo(()=>{const{arrivalDate,departureDate}=roadshow.trip;if(!arrivalDate||!departureDate)return[];const days=[];const s=new Date(arrivalDate+"T12:00:00"),e=new Date(departureDate+"T12:00:00");for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1))days.push(d.toISOString().slice(0,10));return days;},[roadshow.trip.arrivalDate,roadshow.trip.departureDate]);
  // ─── Travel time (OSRM + Nominatim, free, App-level so async setState works) ──
  const rsCoMapForTravel=useMemo(()=>new Map((roadshow.companies||[]).map(c=>[c.id,c])),[roadshow.companies]);

  async function calcAllTravel(){
    const offAddr=roadshow.trip.officeAddress;
    const workDays=tripDays.filter(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;});
    // Build day→meetings map and collect ALL unique addresses up front
    const dayData=workDays.map(date=>{
      const dayMtgs=[...(roadshow.meetings||[])].filter(m=>m.date===date&&m.status!=="cancelled").sort((a,b)=>a.hour-b.hour);
      const addrs=dayMtgs.map(m=>{const co=m.type==="company"?rsCoMapForTravel.get(m.companyId):null;return getMeetingAddress(m,co,offAddr);});
      return{date,dayMtgs,addrs};
    }).filter(({dayMtgs})=>dayMtgs.length>=2);
    if(!dayData.length){alert("No hay días con 2+ reuniones.");return;}
    // Collect unique addresses across ALL days — geocode each only once
    const allAddrs=[...new Set(dayData.flatMap(({addrs})=>addrs))];
    setTravelLoading(true);
    const coords=await geocodeAll(allAddrs); // rate-limited, sequential, no duplicates
    // Now run OSRM for each pair (no rate limit — OSRM is fine with parallel-ish)
    for(const {date,dayMtgs,addrs} of dayData){
      const results={};
      for(let i=0;i<dayMtgs.length-1;i++){
        const o=coords[addrs[i]];const d=coords[addrs[i+1]];
        results[`${date}-${i}`]=(o&&d)?await osrmRoute(o,d):null;
      }
      setTravelCache(prev=>({...prev,[date]:results}));
    }
    setTravelLoading(false);
  }

  async function calcDayTravel(date){
    const offAddr=roadshow.trip.officeAddress;
    const dayMtgs=[...(roadshow.meetings||[])].filter(m=>m.date===date&&m.status!=="cancelled").sort((a,b)=>a.hour-b.hour);
    if(dayMtgs.length<2){alert("Necesitás al menos 2 reuniones en ese día.");return;}
    const addrs=dayMtgs.map(m=>{const co=m.type==="company"?rsCoMapForTravel.get(m.companyId):null;return getMeetingAddress(m,co,offAddr);});
    setTravelLoading(true);
    const coords=await geocodeAll([...new Set(addrs)]);
    const results={};
    for(let i=0;i<dayMtgs.length-1;i++){
      const o=coords[addrs[i]];const d=coords[addrs[i+1]];
      results[`${date}-${i}`]=(o&&d)?await osrmRoute(o,d):null;
    }
    setTravelCache(prev=>({...prev,[date]:results}));
    setTravelLoading(false);
  }
  const rsCoById=useMemo(()=>new Map(roadshow.companies.map(c=>[c.id,c])),[roadshow.companies]);
  const rsBySlot=useMemo(()=>{const m={};(roadshow.meetings||[]).forEach(mt=>{m[`${mt.date}-${mt.hour}`]=mt;});return m;},[roadshow.meetings]);
  const gridMap=useMemo(()=>{
    const map={};
    meetings.filter(m=>slotDay(m.slotId)===activeDay).forEach(m=>{map[`${m.coId}::${slotHour(m.slotId)}`]=m;});
    return map;
  },[meetings,activeDay]);

  const roomMap=useMemo(()=>{
    const map={};
    meetings.filter(m=>slotDay(m.slotId)===activeDay).forEach(m=>{
      if(m.room) map[`${m.room}::${slotHour(m.slotId)}`]=m;
    });
    return map;
  },[meetings,activeDay]);

  const activeRooms=useMemo(()=>{
    const usedRooms=new Set(meetings.filter(m=>slotDay(m.slotId)===activeDay).map(m=>m.room).filter(Boolean));
    const allRooms=getRooms(config);
    // show used rooms + all configured rooms up to numRooms
    return allRooms.filter(r=>usedRooms.has(r)||allRooms.indexOf(r)<config.numRooms);
  },[meetings,activeDay,config.numRooms]);

  // Click-to-move: select a meeting then click a target slot
  function handleMeetingMove(targetSlotId, targetRoom, targetCoId){
    if(!moveSrc) return;
    const m = meetings.find(x=>x.id===moveSrc);
    if(!m){ setMoveSrc(null); return; }
    const newSlotId = targetSlotId;
    const newRoom   = targetRoom || m.room;
    const newCoId   = targetCoId || m.coId;
    // conflict check
    const others = meetings.filter(x=>x.id!==m.id);
    const coConflict = others.find(x=>x.coId===newCoId&&x.slotId===newSlotId);
    const roomConflict = newRoom ? others.find(x=>x.room===newRoom&&x.slotId===newSlotId) : false;
    const invConflict = (m.invIds||[]).find(invId=>others.find(x=>(x.invIds||[]).includes(invId)&&x.slotId===newSlotId));
    if(coConflict||roomConflict||invConflict){
      const msg = coConflict ? `${coById.get(newCoId)?.name||newCoId} ya tiene reunión a ese horario`
                : roomConflict ? `${newRoom} ya está ocupada a ese horario`
                : `Un inversor ya tiene reunión a ese horario`;
      alert("⚠ Conflicto: "+msg);
      setMoveSrc(null); return;
    }
    saveCurrentEvent({meetings: meetings.map(x=>x.id===m.id?{...x,slotId:newSlotId,room:newRoom,coId:newCoId}:x)});
    setMoveSrc(null);
  }

  const filtered=useMemo(()=>{
    if(!search) return investors;
    const q=search.toLowerCase();
    return investors.filter(i=>i.name.toLowerCase().includes(q)||i.fund.toLowerCase().includes(q));
  },[investors,search]);

  const fundGroups=useMemo(()=>{
    const m={};investors.forEach(inv=>{if(inv.fund){if(!m[inv.fund])m[inv.fund]=[];m[inv.fund].push(inv.id);}});
    return Object.entries(m).filter(([,ids])=>ids.length>1);
  },[investors]);

  const CONF_TAB_IDS=["upload","investors","companies","schedule","export","historical"];
  useEffect(()=>{
    const ev=events.find(e=>e.id===activeEv);
    setRoadshow(ev?.roadshow||{trip:RS_TRIP_DEF,companies:RS_COS_DEF,meetings:[]});
    setOutbound(ev?.outbound||OB_DEF);
    // Jump to correct default tab for this event kind
    if(ev?.kind==="roadshow") setTab(t=>CONF_TAB_IDS.includes(t)?"roadshow":t);
    else if(ev?.kind==="outbound") setTab(t=>CONF_TAB_IDS.includes(t)||t==="roadshow"?"outbound":t);
    else setTab(t=>(t==="roadshow"||t==="outbound")?"upload":t);
  },[activeEv]); // eslint-disable-line
  const evKind=currentEvent?.kind||"conference";
  const DB_TAB={id:"db",label:"📚 Librería"};
  const CONF_TABS=[
    {id:"config",label:"⚙ Config"},
    {id:"upload",label:"📥 Cargar"},
    {id:"investors",label:`👥 (${investors.length})`},
    {id:"companies",label:"🏢 Compañías"},
    {id:"schedule",label:"📅 Agenda"},
    {id:"export",label:"⬇ Exportar"},
    {id:"historical",label:"📊 Histórico"},
    {id:"mercado",label:"📈 Mercado"},
    DB_TAB,
  ];
  const RS_TABS=[
    {id:"config",label:"⚙ Config"},
    {id:"roadshow",label:"🗺️ Inbound"},
    {id:"mercado",label:"📈 Mercado"},
    DB_TAB,
  ];
  const OUT_TABS=[
    {id:"config",label:"⚙ Config"},
    {id:"outbound",label:"✈️ Outbound"},
    {id:"mercado",label:"📈 Mercado"},
    DB_TAB,
  ];
  const TABS=evKind==="roadshow"?RS_TABS:evKind==="outbound"?OUT_TABS:CONF_TABS;

  if(!currentEvent) return(
    <div className="app"><style>{CSS}</style>
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,background:"var(--ink)"}}>
        <div style={{fontFamily:"Playfair Display,serif",fontSize:26,color:"var(--cream)",marginBottom:4,letterSpacing:".01em"}}>Latin Securities</div>
        <div style={{color:"var(--dim)",fontSize:12,marginBottom:48,fontFamily:"IBM Plex Mono,monospace",letterSpacing:".12em",textTransform:"uppercase"}}>Latin Securities</div>

        {/* Step 1: choose kind */}
        {!newEvKind&&(
          <div style={{maxWidth:640,width:"100%"}}>
            <div style={{textAlign:"center",fontSize:15,color:"var(--txt)",marginBottom:24}}>¿Qué tipo de evento querés crear?</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,maxWidth:780}}>
              {[
                {kind:"conference",icon:"🏛",title:"Conferencia",subtitle:"Agenda con múltiples inversores y compañías. Carga Excel, genera reuniones automáticamente, exportá schedules por inversor/compañía.",color:"#1e5ab0"},
                {kind:"roadshow",icon:"🗺️",title:"Roadshow Inbound",subtitle:"Inversores visitan Argentina. Coordiná reuniones con compañías, calculá traslados y enviá agenda al cliente.",color:"#23a29e"},
                {kind:"outbound",icon:"✈️",title:"Roadshow Outbound",subtitle:"LS viaja a ver fondos en EEUU, Brasil, Europa, etc. Agenda multi-ciudad y multi-país.",color:"#e8850a"},
              ].map(opt=>(
                <div key={opt.kind} role="button" tabIndex={0}
                  onClick={()=>setNewEvKind(opt.kind)}
                  onKeyDown={e=>{if(e.key==="Enter")setNewEvKind(opt.kind);}}
                  style={{background:"#fff",border:`2px solid rgba(30,90,176,.12)`,borderRadius:14,padding:"28px 24px",cursor:"pointer",transition:"all .18s",textAlign:"center"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=opt.color;e.currentTarget.style.boxShadow=`0 6px 24px ${opt.color}22`;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(30,90,176,.12)";e.currentTarget.style.boxShadow="none";}}>
                  <div style={{fontSize:40,marginBottom:12}}>{opt.icon}</div>
                  <div style={{fontFamily:"Playfair Display,serif",fontSize:18,color:"var(--cream)",marginBottom:8}}>{opt.title}</div>
                  <div style={{fontSize:12,color:"var(--dim)",lineHeight:1.65}}>{opt.subtitle}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: name */}
        {newEvKind&&(
          <div style={{maxWidth:440,width:"100%"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
              <button onClick={()=>setNewEvKind("")} style={{background:"none",border:"none",cursor:"pointer",color:"var(--dim)",fontSize:13,padding:"4px 8px",borderRadius:6,display:"flex",alignItems:"center",gap:5}}>← Volver</button>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:20}}>{newEvKind==="conference"?"🏛":"🗺️"}</span>
                <span style={{fontFamily:"Playfair Display,serif",fontSize:16,color:"var(--cream)"}}>{newEvKind==="conference"?"Nueva Conferencia":"Nuevo Roadshow"}</span>
              </div>
            </div>
            <div className="card">
              <div className="lbl" style={{marginBottom:8}}>Nombre del evento</div>
              <input className="inp" style={{marginBottom:14}} autoFocus
                placeholder={newEvKind==="conference"?"Ej: Argentina NY 2026":"Ej: Brasil Roadshow Abril 2026"}
                value={newEvName} onChange={e=>setNewEvName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&newEvName.trim()&&createEvent(newEvName.trim(),newEvKind)}/>
              <button className="btn bg" style={{width:"100%",fontSize:13,padding:"10px"}}
                onClick={()=>newEvName.trim()&&createEvent(newEvName.trim(),newEvKind)}>
                Crear {newEvKind==="conference"?"conferencia":newEvKind==="outbound"?"roadshow outbound":"roadshow inbound"} →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return(
    <div className="app"><style>{CSS}</style>

    {/* ALWAYS-PRESENT HIDDEN FILE INPUTS — must be at root level so refs work on any tab */}
    <input ref={dbCoExcelRef}   type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleDBCompaniesExcel}/>
    <input ref={dbInvExcelRef}  type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleDBInvestorsExcel}/>
    <input ref={rsExcelRef}     type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleRsExcel}/>
    <input ref={rsMtgsExcelRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleRsMeetingsExcel}/>

    {/* MODALS */}
    {invProfile&&<InvestorModal inv={invProfile} investors={investors} meetings={meetings} companies={companies} config={config}
      fundGrouping={fundGrouping} allSlots={allSlots}
      onUpdateInv={u=>{setInvestors(prev=>prev.map(i=>i.id===u.id?u:i));setInvProfile(u);}}
      onToggleFundGroup={(fund,val)=>setFundGrouping(p=>({...p,[fund]:val}))}
      onExport={exportInvestor} onClose={()=>setInvProfile(null)}/>}
    {coProfile&&<CompanyModal co={coProfile} meetings={meetings} investors={investors} allSlots={allSlots}
      onUpdateCo={u=>{setCompanies(prev=>prev.map(c=>c.id===u.id?u:c));setCoProfile(u);}}
      onExport={exportCompany} onClose={()=>setCoProfile(null)}/>}
    {modal&&<MeetingModal mode={modal.mode} meeting={modal.meeting} investors={investors} meetings={meetings}
      companies={companies} allSlots={allSlots} rooms={rooms} config={config}
      onSave={handleMeetingSave} onDelete={()=>{setMeetings(prev=>prev.filter(m=>m.id!==modal.meeting.id));setModal(null);}}
      onClose={()=>setModal(null)}/>}

    {/* HEADER */}
    <header className="hdr">
      <div className="brand">
        <h1>LS Event Manager</h1>
        <p>Latin Securities · Roadshow/Event Manager</p>
      </div>
      {/* Event switcher */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginRight:16,padding:"0 12px",borderRight:"1px solid rgba(255,255,255,.07)"}}>
        <span style={{fontSize:10,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".06em"}}>Evento:</span>
        <select className="sel" style={{width:"auto",fontSize:11,padding:"4px 8px"}} value={activeEv||""}
          onChange={e=>{setActiveEv(e.target.value);setTab("schedule");}}>
          {events.map(e=><option key={e.id} value={e.id}>{e.kind==="roadshow"?"🗺️":e.kind==="outbound"?"✈️":"🏛"} {e.name}</option>)}
        </select>
        <button className="btn bo bs" style={{fontSize:9}} onClick={()=>setShowEvMgr(true)}>＋ Nuevo</button>
      </div>
      <nav className="nav">
        {TABS.map(t=><button key={t.id} className={`ntab${tab===t.id?" on":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      </nav>
    </header>

    {/* NEW EVENT MODAL */}
    {showEvMgr&&(
      <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setShowEvMgr(false);}}>
        <div className="modal" style={{maxWidth:440}}>
          <div className="modal-hdr"><div className="modal-title">Gestión de Eventos</div></div>
          <div className="modal-body">
            <div style={{marginBottom:16}}>
              <div className="lbl" style={{marginBottom:6}}>Tipo de evento</div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                {[["conference","🏛 Conferencia"],["roadshow","🗺️ Inbound"],["outbound","✈️ Outbound"]].map(([k,l])=>(
                  <button key={k} className={`btn bs ${newEvKind===k?"bg":"bo"}`} style={{flex:1,fontSize:11}} onClick={()=>setNewEvKind(k)}>{l}</button>
                ))}
              </div>
              <div className="lbl" style={{marginBottom:4}}>Nombre del evento</div>
              <div className="flex" style={{marginTop:0}}>
                <input className="inp" style={{flex:1}} placeholder={newEvKind==="conference"?"Ej: Argentina NY 2026":newEvKind==="outbound"?"Ej: US Roadshow Q2 2026":"Ej: Brasil Roadshow Abril 2026"} value={newEvName} onChange={e=>setNewEvName(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&newEvName.trim()&&(createEvent(newEvName.trim(),newEvKind),setShowEvMgr(false))}/>
                <button className="btn bg bs" onClick={()=>{if(newEvName.trim()){createEvent(newEvName.trim(),newEvKind);setShowEvMgr(false);}}}>Crear</button>
              </div>
            </div>
            <div className="sec-hdr">Eventos existentes</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>
              {events.map(e=>(
                <div key={e.id} className={`ev-card${e.id===activeEv?" active-ev":""}`}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{fontSize:13.5,color:"var(--cream)",fontFamily:"Playfair Display,serif"}}>{e.name}</div>
                      <span style={{fontSize:9,padding:"1px 6px",borderRadius:4,fontFamily:"IBM Plex Mono,monospace",background:e.kind==="roadshow"?"rgba(35,162,158,.15)":"rgba(30,90,176,.12)",color:e.kind==="roadshow"?"#23a29e":"var(--gold)",flexShrink:0}}>{e.kind==="roadshow"?"🗺️ Inbound":e.kind==="outbound"?"✈️ Outbound":"🏛 Conferencia"}</span>
                    </div>
                    <div style={{fontSize:10,color:"var(--dim)",marginTop:2}}>{(e.investors||[]).length} inversores · {(e.meetings||[]).length} reuniones</div>
                  </div>
                  <button className="btn bo bs" onClick={()=>{setActiveEv(e.id);setShowEvMgr(false);setTab("schedule");}}>Abrir</button>
                  {events.length>1&&<button className="btn bd bs" onClick={()=>{
                    if(confirm(`Eliminar "${e.name}"?`)){
                      const next=events.filter(x=>x.id!==e.id);setEvents(next);saveEvents(next);
                      if(activeEv===e.id) setActiveEv(next[0]?.id||null);
                    }
                  }}>🗑</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer"><button className="btn bo bs" onClick={()=>setShowEvMgr(false)}>Cerrar</button></div>
        </div>
      </div>
    )}

    <main className="body">

      {/* ════ CONFIG ════ */}
      {tab==="config"&&(
        <div>
          <h2 className="pg-h">Configuración del Evento</h2>
          <p className="pg-s">Todos estos datos se usan en el encabezado y pie de página de los exports.</p>

          {/* ── Event identity ── */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-t">📋 Event Identity</div>
            <div className="g2" style={{gap:12,marginBottom:12}}>
              <div>
                <div className="lbl">Event Title</div>
                <input className="inp" value={config.eventTitle||""} onChange={e=>setConfig(c=>({...c,eventTitle:e.target.value}))} placeholder="LS Conference"/>
              </div>
              <div>
                <div className="lbl">Type / Subtitle</div>
                <input className="inp" value={config.eventType||""} onChange={e=>setConfig(c=>({...c,eventType:e.target.value}))} placeholder="LS Conference / Investor Conference / Corporate Meetings"/>
              </div>
              <div>
                <div className="lbl">Date Range (display)</div>
                <input className="inp" value={config.eventDates||""} onChange={e=>setConfig(c=>({...c,eventDates:e.target.value}))} placeholder="April 14–15, 2026"/>
              </div>
              <div>
                <div className="lbl">Venue</div>
                <input className="inp" value={config.venue||""} onChange={e=>setConfig(c=>({...c,venue:e.target.value}))} placeholder="The Langham, New York, Fifth Avenue"/>
              </div>
            </div>
            {/* Preview */}
            <div style={{background:"var(--ink3)",borderRadius:7,padding:"12px 16px",borderLeft:"3px solid var(--gold)"}}>
              <div style={{fontSize:13,fontWeight:700,color:"var(--cream)"}}>{config.eventTitle||"LS Conference"}</div>
              <div style={{fontSize:11,color:"var(--txt)",marginTop:2}}>{config.eventType||"LS Conference"} · {config.eventDates||"April 14–15, 2026"}</div>
              {config.venue&&<div style={{fontSize:11,color:"var(--dim)",fontStyle:"italic",marginTop:1}}>{config.venue}</div>}
            </div>
          </div>

          {/* ── Event Days ── */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-t">📅 Event Days</div>
            <p style={{fontSize:12,color:"var(--dim)",marginBottom:12,lineHeight:1.6}}>
              Edit date labels or add/remove days. The short label is used in the grid; the long label appears in exported schedules.
            </p>
            {(config.days||DEFAULT_DAYS).map((d,di)=>(
              <div key={d.id} style={{display:"flex",gap:8,alignItems:"center",padding:"8px 0",borderBottom:"1px solid rgba(30,90,176,.07)",marginBottom:4}}>
                <div style={{width:32,height:32,borderRadius:6,background:di%2===0?"#1e5ab0":"#23a29e",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"IBM Plex Mono,monospace",fontSize:11,fontWeight:700,flexShrink:0}}>{di+1}</div>
                <div style={{flex:1}}>
                  <div className="lbl" style={{marginBottom:3}}>Fecha</div>
                  <DayDateInput day={d} di={di} onChange={nd=>{const arr=[...(config.days||DEFAULT_DAYS)];arr[di]=nd;setConfig(c=>({...c,days:arr}));}}/>
                </div>
                <div style={{flex:1}}>
                  <div className="lbl" style={{marginBottom:3}}>Short (grilla)</div>
                  <input className="inp" style={{fontSize:11.5}} value={d.short} placeholder="Tue Apr 14"
                    onChange={e=>{const nd=[...(config.days||DEFAULT_DAYS)];nd[di]={...nd[di],short:e.target.value};setConfig(c=>({...c,days:nd}));}}/>
                </div>
                <div style={{flex:2}}>
                  <div className="lbl" style={{marginBottom:3}}>Long (export)</div>
                  <input className="inp" style={{fontSize:11.5}} value={d.long} placeholder="Tuesday, April 14th 2026"
                    onChange={e=>{const nd=[...(config.days||DEFAULT_DAYS)];nd[di]={...nd[di],long:e.target.value};setConfig(c=>({...c,days:nd}));}}/>
                </div>
                <div style={{flexShrink:0,paddingTop:18}}>
                  {(config.days||DEFAULT_DAYS).length>1&&<button aria-label="Eliminar día" className="btn bd bs" onClick={()=>setConfig(c=>({...c,days:c.days.filter((_,j)=>j!==di)}))}>✕</button>}
                </div>
              </div>
            ))}
            {(config.days||DEFAULT_DAYS).length<5&&(
              <button className="btn bo bs" style={{marginTop:8}} onClick={()=>{
                const idx=(config.days||DEFAULT_DAYS).length+1;
                setConfig(c=>({...c,days:[...(c.days||DEFAULT_DAYS),{id:`day${idx}`,short:`Day ${idx}`,long:`Day ${idx}`}]}));
              }}>+ Add Day</button>
            )}
          </div>

          {/* ── Contacts ── */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-t">📞 Contactos del Evento (pie de página)</div>
            <p style={{fontSize:12,color:"var(--dim)",marginBottom:12}}>Aparecen al pie de cada schedule exportado. El inversor puede contactar a quien necesite.</p>
            {(config.contacts||[]).map((c,i)=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
                  {[["name","Nombre"],["role","Cargo"],["email","Email"],["phone","Teléfono"]].map(([f,lbl])=>(
                    <div key={f}>
                      <div className="lbl">{lbl}</div>
                      <input className="inp" style={{fontSize:11.5}} value={c[f]||""} onChange={e=>{const nc=[...config.contacts];nc[i]={...nc[i],[f]:e.target.value};setConfig(cfg=>({...cfg,contacts:nc}));}}/>
                    </div>
                  ))}
                </div>
                <button aria-label="Eliminar contacto" className="btn bd bs" style={{alignSelf:"flex-end"}} onClick={()=>setConfig(cfg=>({...cfg,contacts:cfg.contacts.filter((_,j)=>j!==i)}))}>✕</button>
              </div>
            ))}
            <button className="btn bo bs" style={{marginTop:10}} onClick={()=>setConfig(c=>({...c,contacts:[...(c.contacts||[]),{name:"",role:"",email:"",phone:""}]}))}>
              + Agregar contacto
            </button>
          </div>

          {/* ── Dinners ── */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-t">🍽 Dinner Events</div>
            <p style={{fontSize:12,color:"var(--dim)",marginBottom:12,lineHeight:1.6}}>Add dinners or evening events. Select which companies are invited — it will appear in their exported schedule.</p>
            {(config.dinners||[]).map((din,di)=>(
              <div key={di} style={{background:"var(--ink3)",borderRadius:8,padding:"13px 15px",marginBottom:10,border:"1px solid rgba(30,90,176,.12)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <span style={{fontFamily:"IBM Plex Mono,monospace",fontSize:10,color:"var(--gold)",textTransform:"uppercase",letterSpacing:".06em"}}>Dinner #{di+1}</span>
                  <button className="btn bd bs" onClick={()=>setConfig(c=>({...c,dinners:c.dinners.filter((_,j)=>j!==di)}))}>✕ Remove</button>
                </div>
                <div className="g2" style={{gap:8,marginBottom:8}}>
                  <div><div className="lbl">Event Name</div>
                    <input className="inp" value={din.name||""} placeholder="Dinner with Companies" onChange={e=>{const nd=[...config.dinners];nd[di]={...nd[di],name:e.target.value};setConfig(c=>({...c,dinners:nd}));}}/></div>
                  <div><div className="lbl">Restaurant</div>
                    <input className="inp" value={din.restaurant||""} placeholder="Nobu New York" onChange={e=>{const nd=[...config.dinners];nd[di]={...nd[di],restaurant:e.target.value};setConfig(c=>({...c,dinners:nd}));}}/></div>
                  <div><div className="lbl">Address</div>
                    <input className="inp" value={din.address||""} placeholder="105 Hudson St, New York" onChange={e=>{const nd=[...config.dinners];nd[di]={...nd[di],address:e.target.value};setConfig(c=>({...c,dinners:nd}));}}/></div>
                  <div className="g2" style={{gap:8}}>
                    <div><div className="lbl">Day</div>
                      <select className="sel" value={din.day||"apr14"} onChange={e=>{const nd=[...config.dinners];nd[di]={...nd[di],day:e.target.value};setConfig(c=>({...c,dinners:nd}));}}>
                        <option value="apr14">Tue Apr 14</option>
                        <option value="apr15">Wed Apr 15</option>
                      </select></div>
                    <div><div className="lbl">Time</div>
                      <input className="inp" value={din.time||""} placeholder="7:30 PM" onChange={e=>{const nd=[...config.dinners];nd[di]={...nd[di],time:e.target.value};setConfig(c=>({...c,dinners:nd}));}}/></div>
                  </div>
                </div>
                <div className="lbl" style={{marginBottom:6}}>Companies invited</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {COMPANIES_INIT.map(co=>{const on=(din.companies||[]).includes(co.id);return(
                    <div key={co.id} onClick={()=>{const nd=[...config.dinners];const cur=nd[di].companies||[];nd[di]={...nd[di],companies:on?cur.filter(x=>x!==co.id):[...cur,co.id]};setConfig(c=>({...c,dinners:nd}));}}
                      style={{padding:"4px 9px",borderRadius:5,cursor:"pointer",fontSize:10.5,fontFamily:"IBM Plex Mono,monospace",
                        background:on?SEC_CLR[co.sector]+"22":"rgba(30,90,176,.05)",
                        border:`1px solid ${on?SEC_CLR[co.sector]+"66":"rgba(30,90,176,.1)"}`,
                        color:on?SEC_CLR[co.sector]:"var(--dim)",fontWeight:on?700:400,transition:"all .12s"}}>
                      {co.ticker}
                    </div>);})}
                </div>
                {(din.companies||[]).length>0&&<div style={{fontSize:10.5,color:"var(--dim)",marginTop:6}}>{(din.companies||[]).length} companies invited</div>}
              </div>
            ))}
            <button className="btn bo bs" onClick={()=>setConfig(c=>({...c,dinners:[...(c.dinners||[]),{id:`din-${Date.now()}`,name:"",restaurant:"",address:"",day:"apr14",time:"7:30 PM",companies:[]}]}))}>
              + Add Dinner Event
            </button>
          </div>

          <div className="g2" style={{marginBottom:14}}>
            <div className="card">
              <div className="card-t">🚪 Salas</div>
              <div className="flex" style={{marginBottom:12}}>
                <input type="range" min={1} max={18} value={config.numRooms} style={{flex:1,accentColor:"var(--gold)"}}
                  onChange={e=>setConfig(c=>({...c,numRooms:parseInt(e.target.value)}))}/>
                <span style={{fontFamily:"IBM Plex Mono,monospace",fontSize:22,color:"var(--gold)",minWidth:28,textAlign:"right"}}>{config.numRooms}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:260,overflowY:"auto"}}>
                {Array.from({length:config.numRooms},(_,i)=>{
                  const customName=((config.roomNames)||{})[i]||"";
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace",minWidth:18,textAlign:"right"}}>{i+1}</span>
                      <input className="inp" style={{flex:1,padding:"5px 8px",fontSize:12}}
                        placeholder={`Room ${i+1}`}
                        value={customName}
                        onChange={e=>{const val=e.target.value;setConfig(c=>({...c,roomNames:{...(c.roomNames||{}),[i]:val}}));}}/>
                      {customName&&<button className="btn bd bs" style={{fontSize:9,padding:"2px 6px"}}
                        onClick={()=>setConfig(c=>{const rn={...(c.roomNames||{})};delete rn[i];return{...c,roomNames:rn};})}>✕</button>}
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:10,color:"var(--dim)",marginTop:8}}>Dejá vacío para usar el nombre por defecto (Room N).</div>
            </div>
            <div className="card">
              <div className="card-t">🕐 Horarios Globales</div>
              <div style={{fontSize:11.5,color:"var(--dim)",marginBottom:10}}>Slots activos para todos los días y compañías.</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4}}>
                {ALL_HOURS.map(h=>{const on=config.hours.includes(h);return(
                  <div key={h} onClick={()=>{const hrs=on?config.hours.filter(x=>x!==h):[...config.hours,h].sort((a,b)=>a-b);if(hrs.length>0)setConfig(c=>({...c,hours:hrs}));}}
                    style={{padding:"6px 4px",borderRadius:5,textAlign:"center",cursor:"pointer",fontSize:10.5,fontFamily:"IBM Plex Mono,monospace",
                      background:on?"rgba(74,175,122,.14)":"rgba(255,255,255,.04)",color:on?"var(--grn)":"var(--dim)",
                      border:`1px solid ${on?"rgba(74,175,122,.28)":"rgba(255,255,255,.06)"}`,transition:"all .12s"}}>
                    {hourLabel(h)}
                  </div>);})}
              </div>
              <div style={{fontSize:11,color:"var(--dim)",marginTop:8}}>
                <span className="bdg bg-grn">{config.hours.length}</span> slots/día · <span className="bdg bg-g">{config.hours.length*2}</span> totales
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-t">🏢 Restricciones por Compañía</div>
            <p style={{fontSize:12,color:"var(--dim)",marginBottom:12,lineHeight:1.7}}>
              Clic en una celda para bloquear ese slot para esa compañía. Ejemplo: BMA arranca 10am → bloqueás 9am del martes. GGAL almuerza 12pm → bloqueás esa celda.
            </p>
            <div style={{overflowX:"auto"}}>
              <table style={{borderCollapse:"collapse",minWidth:600,border:"1px solid rgba(30,90,176,.12)"}}>
                <thead>
                  {/* Day group headers */}
                  <tr>
                    <th rowSpan={2} style={{padding:"6px 12px",textAlign:"left",fontSize:9,fontFamily:"IBM Plex Mono,monospace",color:"var(--gold)",textTransform:"uppercase",letterSpacing:".07em",minWidth:120,background:"rgba(30,90,176,.06)",borderRight:"2px solid rgba(30,90,176,.18)",borderBottom:"1px solid rgba(30,90,176,.12)"}}>Company</th>
                    {getDayIds(config).map(d=>(
                      <th key={d} colSpan={config.hours.length} style={{padding:"5px 8px",textAlign:"center",fontSize:10,fontFamily:"IBM Plex Mono,monospace",fontWeight:700,
                        color:"#fff",letterSpacing:".06em",textTransform:"uppercase",
                        background:getDayIds(config).indexOf(d)%2===0?"#1e5ab0":"#23a29e",
                        borderRight:"2px solid rgba(30,90,176,.18)",borderBottom:"1px solid rgba(30,90,176,.12)"}}>
                        {getDayShort(config)[d]||d}
                      </th>
                    ))}
                  </tr>
                  {/* Hour headers */}
                  <tr>
                    {getDayIds(config).map(d=>config.hours.map(h=>(
                      <th key={`${d}-${h}`} style={{padding:"4px 2px",textAlign:"center",fontSize:9,fontFamily:"IBM Plex Mono,monospace",
                        color:getDayIds(config).indexOf(d)%2===0?"#1e5ab0":"#23a29e",minWidth:48,
                        background:getDayIds(config).indexOf(d)%2===0?"rgba(30,90,176,.06)":"rgba(35,162,158,.06)",
                        borderRight:h===config.hours[config.hours.length-1]?"2px solid rgba(30,90,176,.18)":"1px solid rgba(30,90,176,.08)",
                        borderBottom:"2px solid rgba(30,90,176,.18)"}}>
                        {hourLabel(h)}
                      </th>
                    )))}
                  </tr>
                </thead>
                <tbody>
                  {COMPANIES_INIT.map((co,ri)=>{const bl=config.coBlocks[co.id]||[];return(
                    <tr key={co.id} style={{background:ri%2===0?"#f8fafd":"#ffffff"}}>
                      <td style={{padding:"6px 12px",fontSize:11.5,color:"var(--txt)",whiteSpace:"nowrap",
                        borderRight:"2px solid rgba(30,90,176,.18)",borderBottom:"1px solid rgba(30,90,176,.07)"}}>
                        <span style={{display:"inline-block",width:6,height:6,borderRadius:"50%",background:SEC_CLR[co.sector],marginRight:6,verticalAlign:"middle"}}/>
                        <span style={{color:SEC_CLR[co.sector],fontWeight:700,marginRight:5,fontFamily:"IBM Plex Mono,monospace",fontSize:10.5}}>{co.ticker}</span>
                        <span style={{color:"var(--dim)",fontSize:10}}>{co.name}</span>
                      </td>
                      {getDayIds(config).map((d,di)=>config.hours.map((h,hi)=>{
                        const sid=`${d}-${h}`;const blocked=bl.includes(sid);
                        const isLastHour=hi===config.hours.length-1;
                        return(
                          <td key={sid} onClick={()=>{const cur=config.coBlocks[co.id]||[];const next=blocked?cur.filter(s=>s!==sid):[...cur,sid];setConfig(c=>({...c,coBlocks:{...c.coBlocks,[co.id]:next}}));}}
                            title={`${co.ticker} · ${getDayShort(config)[d]||d} ${hourLabel(h)} — click to ${blocked?"unblock":"block"}`}
                            style={{
                              padding:"5px 3px",textAlign:"center",cursor:"pointer",
                              background:blocked?(getDayIds(config).indexOf(d)%2===0?"rgba(30,90,176,.18)":"rgba(35,162,158,.18)"):"transparent",
                              borderRight:isLastHour?"2px solid rgba(30,90,176,.18)":"1px solid rgba(30,90,176,.07)",
                              borderBottom:"1px solid rgba(30,90,176,.07)",
                              transition:"background .1s",
                              minWidth:48,
                            }}>
                            {blocked
                              ?<span style={{fontSize:13,color:getDayIds(config).indexOf(d)%2===0?"#1e5ab0":"#23a29e",fontWeight:700}}>✕</span>
                              :<span style={{fontSize:9,color:"rgba(30,90,176,.2)"}}>·</span>}
                          </td>);}))}
                    </tr>);})}
                </tbody>
              </table>
            </div>
            {Object.values(config.coBlocks).flat().length>0&&(
              <div style={{marginTop:10,fontSize:11,color:"var(--dim)"}}>
                {Object.values(config.coBlocks).flat().length} slot(s) bloqueado(s).
                <button className="btn bd bs" style={{marginLeft:8}} onClick={()=>setConfig(c=>({...c,coBlocks:{}}))}>Limpiar todo</button>
              </div>
            )}
          </div>

          <div className="flex" style={{marginTop:4}}>
            {investors.length>0&&<button className="btn bg" onClick={generate}>🚀 Re-generar con esta config</button>}
            <button className="btn bo" onClick={()=>setConfig(DEFAULT_CONFIG)}>↺ Restaurar defaults</button>
          </div>
        </div>
      )}

      {/* ════ UPLOAD ════ */}
      {tab==="upload"&&(
        <div>
          <h2 className="pg-h">Cargar Respuestas</h2>
          <p className="pg-s">Excel exportado de Microsoft Forms — procesamiento automático.</p>
          <div className="card">
            <div className="upz" role="button" tabIndex={0} aria-label="Subir archivo Excel" onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")fileRef.current?.click();}} onClick={()=>fileRef.current?.click()}>
              <div style={{fontSize:34,marginBottom:8}}>📊</div>
              <div style={{fontSize:15,color:"var(--cream)",marginBottom:4}}>{fileName||"Hacé clic para seleccionar el archivo"}</div>
              <div style={{fontSize:12,color:"var(--dim)"}}>{fileName?<span style={{color:"var(--grn)"}}>✓ {investors.length} inversores cargados</span>:"Formato .xlsx · Microsoft Forms export"}</div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleFile}/>
            </div>
          </div>
          {investors.length>0&&<div className="flex" style={{marginTop:4}}>
            <button className="btn bg" onClick={generate}>🚀 Generar agenda</button>
            <button className="btn bo" onClick={()=>setTab("investors")}>Ver inversores →</button>
          </div>}

          {/* ── Previous year comparison ── */}
          <div className="card" style={{marginTop:20}}>
            <div className="card-t">🔍 Comparar con año anterior</div>
            <p style={{fontSize:12,color:"var(--dim)",marginBottom:14,lineHeight:1.6}}>Subí la lista de inversores del año anterior para ver quién aún no se anotó este año. <strong style={{color:"var(--cream)"}}>Para análisis multi-año usá la tab 📊 Histórico.</strong></p>
            <div className="upz" style={{padding:"18px 20px"}} role="button" tabIndex={0} aria-label="Subir archivo de año anterior" onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")prevYearRef.current?.click();}} onClick={()=>prevYearRef.current?.click()}>
              <div style={{fontSize:24,marginBottom:6}}>📂</div>
              <div style={{fontSize:13,color:"var(--cream)",marginBottom:3}}>
                {prevYearData?prevYearData.fileName:"Seleccionar archivo del año anterior"}
              </div>
              <div style={{fontSize:11,color:"var(--dim)"}}>
                {prevYearData
                  ?<span style={{color:"var(--grn)"}}>✓ {prevYearData.total} registros cargados</span>
                  :"Mismo formato que el archivo actual (.xlsx)"}
              </div>
              <input ref={prevYearRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handlePrevYear}/>
            </div>
            {prevYearData&&(
              <div style={{marginTop:14}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{fontSize:13,color:"var(--cream)",fontWeight:600}}>
                    {prevYearData.missing.length===0
                      ?"✅ Todos los inversores del año anterior ya se anotaron este año."
                      :`⚠️ ${prevYearData.missing.length} inversor${prevYearData.missing.length!==1?"es":""} del año anterior aún no se anot${prevYearData.missing.length!==1?"aron":"ó"}`}
                  </div>
                  {prevYearData.missing.length>0&&<button className="btn bo bs" onClick={()=>{
                    const lines=["Name,Fund,Email",...prevYearData.missing.map(p=>`"${p.name}","${p.fund}","${p.email}"`)].join("\n");
                    const blob=new Blob([lines],{type:"text/csv"});
                    const url=URL.createObjectURL(blob);
                    const a=document.createElement("a");a.href=url;a.download="missing_investors.csv";a.click();
                    setTimeout(()=>URL.revokeObjectURL(url),3000);
                  }}>⬇ Exportar CSV</button>}
                  <button className="btn bd bs" onClick={()=>setPrevYearData(null)}>✕ Limpiar</button>
                </div>
                {prevYearData.missing.length>0&&(
                  <div style={{maxHeight:180,overflowY:"auto",border:"1px solid rgba(30,90,176,.1)",borderRadius:7}}>
                    <table className="tbl">
                      <thead><tr><th>Nombre</th><th>Fondo / Firma</th><th>Email</th></tr></thead>
                      <tbody>
                        {prevYearData.missing.map((p,i)=>(
                          <tr key={i}>
                            <td style={{fontSize:12}}>{p.name}</td>
                            <td style={{fontSize:12,color:"var(--dim)"}}>{p.fund||"—"}</td>
                            <td style={{fontSize:11,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>{p.email||"—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ INVESTORS ════ */}
      {tab==="investors"&&(
        <div>
          <h2 className="pg-h">Inversores / Fondos</h2>
          <p className="pg-s">Clic en un inversor para ver su perfil, editar restricciones o exportar su schedule.</p>
          <div className="stats">
            <div className="stat"><div className="sv">{investors.length}</div><div className="sl">Inversores</div></div>
            <div className="stat"><div className="sv">{investors.reduce((s,i)=>s+(i.companies?.length||0),0)}</div><div className="sl">Solicitudes</div></div>
            <div className="stat"><div className="sv">{fundGroups.length}</div><div className="sl">Fondos</div></div>
            <div className="stat"><div className="sv">{investors.filter(i=>(i.blockedSlots||[]).length>0).length}</div><div className="sl">Con restricciones</div></div>
          </div>
          {fundSimilarities.length>0&&(
            <div className="alert ai" style={{marginBottom:12}}>
              <strong style={{color:"var(--cream)"}}>⚠ Fondos similares detectados — ¿son el mismo?</strong>
              <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:6}}>
                {fundSimilarities.map((s,i)=>{
                  const [a,b]=s.pair.split("|||");
                  return(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 10px",background:"rgba(74,143,212,.08)",borderRadius:6}}>
                    <span style={{fontSize:12,color:"var(--cream)"}}><strong>"{a}"</strong> y <strong>"{b}"</strong></span>
                    <span style={{fontSize:10,color:"var(--dim)",flex:1}}>→ ya agrupados como <em>{s.canonical}</em></span>
                    <button className="btn bg bs" style={{fontSize:9}} onClick={()=>{
                      // Re-normalize all investors: replace b with a (canonical)
                      setInvestors(prev=>prev.map(inv=>({...inv,fund:inv.fund===b?a:inv.fund})));
                    }}>✓ Confirmar</button>
                    <button className="btn bd bs" style={{fontSize:9}} onClick={()=>{
                      // Keep them separate — remove from similarities
                      saveCurrentEvent({fundSimilarities:fundSimilarities.filter((_,j)=>j!==i)});
                    }}>✕ Separar</button>
                  </div>);
                })}
              </div>
            </div>
          )}
          {fundGroups.length>0&&(
            <div className="card" style={{marginBottom:14}}>
              <div className="card-t">👥 Fondos con múltiples inversores</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {fundGroups.map(([fund,ids])=>(
                  <div key={fund} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",background:"var(--ink3)",borderRadius:7,border:"1px solid rgba(30,90,176,.1)"}}>
                    <span style={{fontSize:12,color:"var(--txt)"}}>{fund}</span>
                    <span style={{fontSize:10,color:"var(--dim)"}}>{ids.length} personas</span>
                    <label className="toggle" style={{marginLeft:4}}>
                      <input type="checkbox" checked={fundGrouping[fund]!==false} onChange={()=>setFundGrouping(p=>({...p,[fund]:!(p[fund]!==false)}))}/>
                      <div className="toggle-track"/><div className="toggle-thumb"/>
                    </label>
                    <span style={{fontSize:9,color:fundGrouping[fund]!==false?"var(--gold)":"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>{fundGrouping[fund]!==false?"juntos":"separados"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex" style={{marginBottom:12}}>
            <div className="srch" style={{flex:1,maxWidth:300}}><span className="srch-ic">🔍</span><input className="inp srch" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
            <button className="btn bg" style={{marginLeft:"auto"}} onClick={generate}>🚀 Generar agenda</button>
          </div>
          <div style={{maxHeight:560,overflowY:"auto"}}>
            {filtered.map(inv=>(
              <div key={inv.id} className="ent-row" role="button" tabIndex={0} aria-label={`Ver perfil de ${inv.name}`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")setInvProfile(inv);}} onClick={()=>setInvProfile(inv)}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"Playfair Display,serif",fontSize:14,color:"var(--cream)"}}>{inv.name}</span>
                    {(inv.blockedSlots||[]).length>0&&<span className="bdg bg-r">{inv.blockedSlots.length} bloq.</span>}
                  </div>
                  <div style={{fontSize:11,color:"var(--dim)",marginTop:2}}>{inv.fund&&<strong style={{color:"var(--txt)"}}>{inv.fund}</strong>}{inv.position&&<> · {inv.position}</>}{inv.aum&&<span className="bdg bg-g" style={{marginLeft:6}}>{inv.aum}</span>}</div>
                  <div style={{marginTop:4,display:"flex",flexWrap:"wrap",gap:3}}>
                    {(inv.companies||[]).map(cid=>{const c=coById.get(cid);return<span key={cid} className="tag" style={{borderColor:`${SEC_CLR[c?.sector]||"var(--gold)"}44`,color:SEC_CLR[c?.sector]||"var(--gold2)"}}>{c?.ticker||cid}</span>;})}
                  </div>
                </div>
                <div style={{fontSize:10,color:"var(--dim)",textAlign:"right",flexShrink:0}}>
                  <div>{(inv.companies||[]).length} co.</div>
                  <div>{effectiveSlots(inv,allSlots).length} slots</div>
                  {scheduled&&<div className="bdg bg-grn" style={{marginTop:3}}>{(byInvestor[inv.id]||[]).length} mtgs</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════ COMPANIES ════ */}
      {tab==="companies"&&(
        <div>
          <h2 className="pg-h">Compañías</h2>
          <p className="pg-s">Click to manage representatives, view meetings or export schedule.</p>
          {/* ── Add company ── */}
          <div className="card" style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:showAddCo?12:0}}>
              <div className="card-t" style={{marginBottom:0}}>🏢 Manage Companies ({companies.length})</div>
              <button className="btn bo bs" onClick={()=>setShowAddCo(s=>!s)}>{showAddCo?"✕ Cancel":"+ Add Company"}</button>
            </div>
            {showAddCo&&<div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
              <div><div className="lbl">Name</div><input className="inp" style={{minWidth:160}} value={newCoForm.name} onChange={e=>setNewCoForm(p=>({...p,name:e.target.value}))} placeholder="Empresa SA"/></div>
              <div><div className="lbl">Ticker</div><input className="inp" style={{width:80}} value={newCoForm.ticker} onChange={e=>setNewCoForm(p=>({...p,ticker:e.target.value.toUpperCase()}))} placeholder="EMP"/></div>
              <div><div className="lbl">Sector</div>
                <select className="sel" style={{width:130}} value={newCoForm.sector} onChange={e=>setNewCoForm(p=>({...p,sector:e.target.value}))}>
                  {["Financials","Energy","Infra","Real Estate","TMT","LS"].map(s=><option key={s}>{s}</option>)}
                </select></div>
              <button className="btn bg bs" style={{alignSelf:"flex-end"}} onClick={()=>{
                if(!newCoForm.name.trim()||!newCoForm.ticker.trim()) return;
                const id=newCoForm.ticker.trim().toUpperCase();
                if(coById.get(id)){alert("Ticker already exists");return;}
                setCompanies(prev=>[...prev,{id,name:newCoForm.name.trim(),ticker:id,sector:newCoForm.sector,attendees:[]}]);
                setNewCoForm({name:"",ticker:"",sector:"Financials"});setShowAddCo(false);
              }}>Add</button>
            </div>}
          </div>

          {/* ── Reps upload ── */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-t">📋 Import Company Representatives</div>
            <p style={{fontSize:12,color:"var(--dim)",marginBottom:10,lineHeight:1.6}}>
              Upload an Excel or CSV with columns: <strong style={{color:"var(--txt)"}}>Company</strong> (name or ticker), <strong style={{color:"var(--txt)"}}>Name</strong>, <strong style={{color:"var(--txt)"}}>Title</strong> (optional).
            </p>
            <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <label style={{cursor:"pointer"}}>
                <input type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={e=>{
                  const file=e.target.files?.[0]; if(!file) return;
                  const reader=new FileReader();
                  reader.onload=ev=>{
                    const wb=XLSX.read(ev.target.result,{type:"array"});
                    const ws=wb.Sheets[wb.SheetNames[0]];
                    const rows=XLSX.utils.sheet_to_json(ws,{header:1});
                    if(rows.length<2){alert("File too short");return;}
                    const hdrs=rows[0].map(h=>String(h||"").toLowerCase().trim());
                    const ci=kw=>hdrs.findIndex(h=>h.includes(kw));
                    const coIdx=ci("compan")>=0?ci("compan"):ci("ticker")>=0?ci("ticker"):0;
                    const nmIdx=ci("name")>=0?ci("name"):1;
                    const ttIdx=ci("title")>=0?ci("title"):ci("cargo")>=0?ci("cargo"):ci("position")>=0?ci("position"):2;
                    let added=0,skipped=0;
                    const updatedCos=[...companies];
                    rows.slice(1).forEach(row=>{
                      const rawCo=String(row[coIdx]||"").trim();
                      const name=capitalizeName(String(row[nmIdx]||"").trim());
                      const title=normalizePosition(String(row[ttIdx]||"").trim());
                      if(!rawCo||!name) return;
                      // Match by ticker or name
                      const coIdx2=updatedCos.findIndex(c=>
                        c.ticker.toLowerCase()===rawCo.toLowerCase()||
                        c.name.toLowerCase().includes(rawCo.toLowerCase())||
                        rawCo.toLowerCase().includes(c.ticker.toLowerCase())
                      );
                      if(coIdx2<0){skipped++;return;}
                      const existing=updatedCos[coIdx2].attendees||[];
                      if(existing.some(a=>a.name.toLowerCase()===name.toLowerCase())){skipped++;return;}
                      updatedCos[coIdx2]={...updatedCos[coIdx2],attendees:[...existing,{name,title}]};
                      added++;
                    });
                    setCompanies(updatedCos);
                    alert(`✓ ${added} representatives imported. ${skipped} skipped (not matched or duplicate).`);
                  };
                  reader.readAsArrayBuffer(file);
                  e.target.value="";
                }}/>
                <span className="btn bg bs">📥 Upload Excel / CSV</span>
              </label>
              <button className="btn bd bs" onClick={()=>{if(confirm("Clear ALL company representatives?"))setCompanies(companies.map(c=>({...c,attendees:[]})));}}>🗑 Clear all reps</button>
              <span style={{fontSize:11,color:"var(--dim)"}}>
                {companies.reduce((s,c)=>s+(c.attendees||[]).length,0)} total reps across {companies.filter(c=>(c.attendees||[]).length>0).length} companies
              </span>
            </div>
          </div>
          {["Financials","Energy","Infra","Real Estate","TMT","LS"].map(sector=>{
            const scos=companies.filter(c=>c.sector===sector); if(!scos.length) return null;
            return(<div key={sector}>
              <div className="sec-hdr">{{Financials:"🏦 Financials",Energy:"⚡ Energy",Infra:"🏛 Infrastructure","Real Estate":"🏛 Real Estate",TMT:"📳 TMT",LS:"🏛 Latin Securities"}[sector]||sector}</div>
              <div className="g3" style={{marginBottom:10}}>
                {scos.map(co=>{
                  const cms=byCompany[co.id]||[];const demandInvs=new Set(investors.flatMap(i=>(i.companies||[]).includes(co.id)?[i.id]:[])).size;
                  return(<div key={co.id} className="ent-row" style={{flexDirection:"column",gap:5,position:"relative"}}>
                    <div style={{display:"flex",alignItems:"baseline",gap:7}} onClick={()=>setCoProfile(co)}>
                      <span style={{fontFamily:"Playfair Display,serif",fontSize:13.5,color:"var(--cream)"}}>{co.name}</span>
                      <span className="bdg bg-g">{co.ticker}</span>
                      {fixedRoom[co.id]&&<span className="bdg bg-b" style={{fontSize:9}}>{fixedRoom[co.id]}</span>}
                      <button className="btn bd bs" style={{marginLeft:"auto",fontSize:9,padding:"2px 7px"}} onClick={e=>{e.stopPropagation();if(confirm(`Remove ${co.name}?`))setCompanies(prev=>prev.filter(c=>c.id!==co.id));}}>✕</button>
                    </div>
                    <div style={{fontSize:11,color:"var(--dim)",cursor:"pointer"}} onClick={()=>setCoProfile(co)}>Demand: <strong style={{color:"var(--txt)"}}>{demandInvs}</strong>{scheduled&&<> · <strong style={{color:"var(--grn)"}}>{cms.length}</strong> meetings</>}</div>
                    {(co.attendees||[]).length>0&&<div style={{fontSize:10,color:"var(--dim)"}}>👤 {(co.attendees||[]).map(a=>a.name).join(", ")}</div>}
                    <div className="dbar"><div className="dfill" style={{width:`${Math.min(100,(demandInvs/25)*100)}%`,background:SEC_CLR[co.sector]}}/></div>
                  </div>);
                })}
              </div>
            </div>);
          })}
        </div>
      )}

      {/* ════ SCHEDULE ════ */}
      {tab==="schedule"&&(
        <div>
          <h2 className="pg-h">Agenda</h2>
          <p className="pg-s">Clic en celda para editar · Compañías fijas · Inversores se mueven</p>
          {!scheduled&&investors.length===0&&<div className="alert aw" aria-live="polite">Cargá el archivo Excel primero.</div>}
          {!scheduled&&investors.length>0&&<div className="alert ai" aria-live="polite">{investors.length} inversores listos. <button className="btn bg bs" style={{marginLeft:10}} onClick={generate}>🚀 Generar</button></div>}
          {scheduled&&(<>
            <div className="stats">
              <div className="stat"><div className="sv">{meetings.length}</div><div className="sl">Reuniones</div></div>
              <div className="stat"><div className="sv" style={{color:unscheduled.length?"var(--red)":undefined}}>{unscheduled.length}</div><div className="sl" style={{color:unscheduled.length?"var(--red)":undefined}}>Sin asignar</div></div>
              <div className="stat"><div className="sv">{meetingStats.counts[getDayIds(config)[0]]||0}</div><div className="sl" style={{color:"var(--blu)"}}>{getDayShort(config)[getDayIds(config)[0]]||'Day 1'}</div></div>
              <div className="stat"><div className="sv">{meetingStats.counts[getDayIds(config)[1]]||0}</div><div className="sl" style={{color:"var(--grn)"}}>{getDayShort(config)[getDayIds(config)[1]]||'Day 2'}</div></div>
              <div className="stat"><div className="sv">{meetingStats.groupCount}</div><div className="sl">Grupales</div></div>
            </div>
            {unscheduled.length>0&&<div className="alert aw" aria-live="polite" style={{marginBottom:12}}>⚠ {unscheduled.length} reunión(es) sin asignar.</div>}
            {/* ── Toolbar ── */}
            <div className="flex" style={{marginBottom:12,flexWrap:"wrap",gap:6}}>
              {getDayIds(config).map((d,di)=><button key={d} className={`day-btn ${activeDay===d?(di%2===0?"d14on":"d15on"):"doff"}`} onClick={()=>setActiveDay(d)}>
                {getDayShort(config)[d]||d}
                <span style={{opacity:.7,marginLeft:4}}>({meetingStats.counts[d]||0})</span>
              </button>)}
              <div style={{display:"flex",gap:4,marginLeft:"auto",background:"var(--ink3)",borderRadius:6,padding:3}}>
                <button className={`btn bs ${schedView==="company"?"bg":"bo"}`} style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setSchedView("company")}>🏢 Compañía</button>
                <button className={`btn bs ${schedView==="room"?"bg":"bo"}`} style={{fontSize:10,padding:"4px 10px"}} onClick={()=>setSchedView("room")}>🚪 Sala</button>
              </div>
              <button className="btn bo bs" onClick={()=>setModal({mode:"add"})}>＋ Agregar</button>
              <button className="btn bo bs" onClick={generate}>↺ Re-generar</button>
              <button className="btn bg bs" onClick={()=>setTab("export")}>⬇ Exportar →</button>
            </div>

            {moveSrc&&<div className="alert ai" style={{marginBottom:8,padding:"6px 12px",fontSize:11,display:"flex",alignItems:"center",gap:10}}>
              <span>✋ <strong>{coById.get(meetings.find(x=>x.id===moveSrc)?.coId)?.ticker||"Reunión"}</strong> seleccionada para mover — hacé clic en una celda vacía para colocarla.</span>
              <button className="btn bd bs" style={{fontSize:9}} onClick={()=>setMoveSrc(null)}>✕ Cancelar</button>
            </div>}

            {/* ── COMPANY VIEW ── */}
            {schedView==="company"&&(
            <div className="card" style={{padding:"10px 4px"}}>
              <div className="grid-wrap">
                <table className="grid-tbl">
                  <colgroup><col style={{width:72}}/>{dayCos.map(c=><col key={c.id} style={{minWidth:110}}/>)}</colgroup>
                  <thead>
                    <tr>
                      <th className="th-time" style={{borderBottom:"1px solid rgba(30,90,176,.07)"}}/>
                      {dayCos.map(c=><th key={c.id} className="th-sect" style={{background:`${SEC_CLR[c.sector]}12`,color:SEC_CLR[c.sector],borderBottom:`2px solid ${SEC_CLR[c.sector]}45`}}>{c.sector}</th>)}
                    </tr>
                    <tr>
                      <th className="th-time">Hora</th>
                      {dayCos.map(c=>(
                        <th key={c.id} className="th-co" style={{borderBottom:`2px solid ${SEC_CLR[c.sector]}45`}}>
                          <div style={{color:SEC_CLR[c.sector],fontFamily:"Lora,serif",fontWeight:600,fontSize:11}}>{c.name}</div>
                          <div style={{fontSize:8,color:"var(--dim)",marginTop:1,fontFamily:"IBM Plex Mono,monospace"}}>{c.ticker}{fixedRoom[c.id]?` · ${fixedRoom[c.id]}`:""}</div>
                          <div className="dbar"><div className="dfill" style={{width:`${Math.min(100,((byCompany[c.id]||[]).length/config.hours.length)*100)}%`,background:SEC_CLR[c.sector]}}/></div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {config.hours.map(h=>(
                      <tr key={h}>
                        <td className="td-time">{hourLabel(h)}</td>
                        {dayCos.map(c=>{
                          const m=gridMap[`${c.id}::${h}`];
                          const isCoBlocked=(config.coBlocks[c.id]||[]).includes(`${activeDay}-${h}`);
                          const slotId=`${activeDay}-${h}`;
                          if(m){
                            const invs=(m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);
                            const sclr=SEC_CLR[c.sector]||"var(--gold)";
                            const isGroup=new Set(invs.map(i=>i.fund||i.id).filter(Boolean)).size>1;
                            const isSelected = moveSrc===m.id;
                            return(
                              <td key={c.id} className="td-c"
                                onClick={()=>moveSrc ? (moveSrc===m.id ? setMoveSrc(null) : null) : setModal({mode:"edit",meeting:m})}
                                title={moveSrc ? (moveSrc===m.id?"Cancelar movimiento":"Ocupado") : "Clic para editar · Alt+Clic para mover"}
                                style={{cursor:moveSrc?(moveSrc===m.id?"not-allowed":"default"):"pointer",outline:isSelected?"2px solid var(--gold)":"none",outlineOffset:-2}}>
                                <div className="m-pill" style={{background:isSelected?`${sclr}33`:`${sclr}11`,borderLeftColor:sclr,position:"relative"}}>
                                  {!moveSrc&&<span style={{position:"absolute",top:2,right:4,fontSize:9,color:"var(--dim)",opacity:.5,cursor:"grab"}} onMouseDown={e=>{e.stopPropagation();setMoveSrc(m.id);}}>⠿</span>}
                                  <div className="mp-n">{isGroup?invs.map(i=>i.name.split(" ")[0]).join(" + "):invs[0]?.name}</div>
                                  <div className="mp-f">{isGroup?`${invs[0]?.fund} (${invs.length})`:invs[0]?.fund}</div>
                                  <div style={{display:"flex",alignItems:"center",gap:3,marginTop:1}}>
                                    <span style={{background:sclr,color:"#fff",fontSize:7,fontWeight:800,padding:"1px 3px",borderRadius:2,flexShrink:0}}>{c.ticker}</span>
                                    <span className="mp-r">{m.room}</span>
                                  </div>
                                </div>
                              </td>);
                          }
                          if(isCoBlocked) return <td key={c.id} className="td-c" style={{background:"rgba(214,68,68,.07)",cursor:"default"}}><span style={{color:"rgba(214,68,68,.3)",fontSize:11,display:"block",textAlign:"center",lineHeight:"50px"}}>✕</span></td>;
                          return (
                            <td key={c.id} className="td-c"
                              onClick={()=>moveSrc ? handleMeetingMove(slotId, fixedRoom[c.id]||null, c.id) : setModal({mode:"add",prefCoId:c.id,prefSlotId:slotId})}
                              style={{background:moveSrc?"rgba(30,90,176,.06)":undefined,cursor:moveSrc?"crosshair":"pointer"}}>
                              {moveSrc?<span style={{color:"rgba(30,90,176,.4)",fontSize:20,display:"block",textAlign:"center",lineHeight:"50px"}}>⬇</span>:<span className="add-ic">+</span>}
                            </td>);
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* ── ROOM VIEW ── */}
            {schedView==="room"&&(
            <div className="card" style={{padding:"10px 4px"}}>
              <div className="grid-wrap">
                <table className="grid-tbl">
                  <colgroup><col style={{width:72}}/>{activeRooms.map(r=><col key={r} style={{minWidth:120}}/>)}</colgroup>
                  <thead>
                    <tr>
                      <th className="th-time">Hora</th>
                      {activeRooms.map(r=>(
                        <th key={r} className="th-co" style={{borderBottom:"2px solid rgba(30,90,176,.3)"}}>
                          <div style={{color:"var(--blu)",fontFamily:"IBM Plex Mono,monospace",fontWeight:700,fontSize:11}}>🚪 {r}</div>
                          <div style={{fontSize:9,color:"var(--dim)",marginTop:2}}>
                            {meetings.filter(m=>m.room===r&&slotDay(m.slotId)===activeDay).length} reuniones
                          </div>
                          <div className="dbar"><div className="dfill" style={{width:`${Math.min(100,(meetings.filter(m=>m.room===r&&slotDay(m.slotId)===activeDay).length/config.hours.length)*100)}%`,background:"#3399ff"}}/></div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {config.hours.map(h=>(
                      <tr key={h}>
                        <td className="td-time">{hourLabel(h)}</td>
                        {activeRooms.map(r=>{
                          const m=roomMap[`${r}::${h}`];
                          const slotId=`${activeDay}-${h}`;
                          if(m){
                            const co=coById.get(m.coId);
                            const invs=(m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);
                            const sclr=SEC_CLR[co?.sector]||"var(--gold)";
                            const isGroup=new Set(invs.map(i=>i.fund||i.id).filter(Boolean)).size>1;
                            const isSelectedR = moveSrc===m.id;
                            return(
                              <td key={r} className="td-c"
                                onClick={()=>moveSrc ? (moveSrc===m.id ? setMoveSrc(null) : null) : setModal({mode:"edit",meeting:m})}
                                style={{cursor:moveSrc?(moveSrc===m.id?"not-allowed":"default"):"pointer",outline:isSelectedR?"2px solid var(--gold)":"none",outlineOffset:-2}}>
                                <div className="m-pill" style={{background:isSelectedR?`${sclr}33`:`${sclr}11`,borderLeftColor:sclr,position:"relative"}}>
                                  {!moveSrc&&<span style={{position:"absolute",top:2,right:4,fontSize:9,color:"var(--dim)",opacity:.5,cursor:"grab"}} onMouseDown={e=>{e.stopPropagation();setMoveSrc(m.id);}}>⠿</span>}
                                  <div style={{display:"flex",alignItems:"center",gap:3,marginBottom:2}}>
                                    <span style={{background:sclr,color:"#fff",fontSize:8,fontWeight:800,padding:"1px 4px",borderRadius:3,letterSpacing:".03em",flexShrink:0}}>{co?.ticker||"?"}</span>
                                    <span style={{fontSize:9,color:"var(--cream)",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{co?.name}</span>
                                  </div>
                                  <div className="mp-f">{isGroup?invs.map(i=>i.name.split(" ")[0]).join(" + "):invs[0]?.name}</div>
                                  <div className="mp-r" style={{color:"var(--dim)"}}>{invs[0]?.fund}</div>
                                </div>
                              </td>);
                          }
                          return (
                            <td key={r} className="td-c"
                              onClick={()=>{
                                if(moveSrc){ const srcM=meetings.find(x=>x.id===moveSrc); handleMeetingMove(slotId, r, srcM?.coId); }
                                else setModal({mode:"add",prefSlotId:slotId});
                              }}
                              style={{background:moveSrc?"rgba(30,90,176,.06)":undefined,cursor:moveSrc?"crosshair":"pointer"}}>
                              {moveSrc?<span style={{color:"rgba(30,90,176,.4)",fontSize:20,display:"block",textAlign:"center",lineHeight:"50px"}}>⬇</span>:<span className="add-ic">+</span>}
                            </td>);
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}
            {unscheduled.length>0&&(
              <div className="card" style={{marginTop:12}}>
                <div className="card-t" style={{color:"var(--red)"}}>⚠ Sin asignar</div>
                <table className="tbl"><thead><tr><th>Inversor(es)</th><th>Compañía</th><th>Acción</th></tr></thead>
                  <tbody>{unscheduled.map((u,i)=>(<tr key={i}>
                    <td>{(u.invIds||[]).map(id=>invById.get(id)?.name).join(", ")}</td>
                    <td>{coById.get(u.coId)?.name}</td>
                    <td><button className="btn bo bs" onClick={()=>setModal({mode:"add",prefInvIds:u.invIds,prefCoId:u.coId})}>Asignar →</button></td>
                  </tr>))}</tbody>
                </table>
              </div>
            )}
          </>)}
        </div>
      )}

      {/* ════ EXPORT ════ */}
      {tab==="export"&&(
        <div>
          <h2 className="pg-h">Exportar Schedules</h2>
          <p className="pg-s">Formato Latin Securities — listo para entregar.</p>
          {!scheduled&&<div className="alert aw" aria-live="polite">Generá la agenda primero.</div>}
          {scheduled&&(<>
            <div className="card" style={{marginBottom:18}}>
              <div className="card-t">📊 Resumen</div>
              <div className="g3">
                <div style={{padding:"10px 0",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{fontSize:26,fontFamily:"Playfair Display,serif",color:"var(--gold)"}}>{companies.filter(c=>meetings.some(m=>m.coId===c.id)).length}</div>
                  <div style={{fontSize:9.5,color:"var(--dim)",textTransform:"uppercase",letterSpacing:".08em",fontFamily:"IBM Plex Mono,monospace",marginTop:3}}>Compañías</div>
                </div>
                <div style={{padding:"10px 12px",borderRight:"1px solid rgba(255,255,255,.06)"}}>
                  <div style={{fontSize:26,fontFamily:"Playfair Display,serif",color:"var(--gold)"}}>{investors.filter(inv=>meetings.some(m=>(m.invIds||[]).includes(inv.id))).length}</div>
                  <div style={{fontSize:9.5,color:"var(--dim)",textTransform:"uppercase",letterSpacing:".08em",fontFamily:"IBM Plex Mono,monospace",marginTop:3}}>Inversores</div>
                </div>
                <div style={{padding:"10px 12px"}}>
                  <div style={{fontSize:26,fontFamily:"Playfair Display,serif",color:"var(--gold)"}}>{meetings.length}</div>
                  <div style={{fontSize:9.5,color:"var(--dim)",textTransform:"uppercase",letterSpacing:".08em",fontFamily:"IBM Plex Mono,monospace",marginTop:3}}>Reuniones</div>
                </div>
              </div>
            </div>
            <div className="sec-hdr" style={{marginBottom:8}}>📊 Excel con Colores LS</div>
            <div className="g2" style={{marginBottom:20}}>
              <div className="ex-card" role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")exportExcel();}} onClick={exportExcel} style={{border:"1px solid rgba(51,153,255,.3)",background:"rgba(51,153,255,.04)"}}>
                <div className="ex-card-ico">🟦📊</div>
                <div className="ex-card-t">Agenda Completa — Excel</div>
                <div className="ex-card-s">4 solapas: agenda, por compañía, por inversor, lista. Colores Latin Securities.</div>
              </div>
            </div>
            <div className="sec-hdr" style={{marginBottom:8}}>🏢 Por Compañía</div>
            <div className="g2" style={{marginBottom:20}}>
              <div className="ex-card" role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")()=>exportAll("companies","word")}} onClick={()=>exportAll("companies","word")}><div className="ex-card-ico">📝🗜</div><div className="ex-card-t">Todas — Word ZIP</div><div className="ex-card-s">Un .doc por compañía en un ZIP.</div></div>
              <div className="ex-card" role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")()=>exportAll("companies","pdf_combined")}} onClick={()=>exportAll("companies","pdf_combined")}><div className="ex-card-ico">📄</div><div className="ex-card-t">Todas — PDF combinado</div><div className="ex-card-s">Un solo PDF con todas las compañías.</div></div>
            </div>
            <div className="sec-hdr" style={{marginBottom:8}}>💼 Por Inversor</div>
            <div className="g2" style={{marginBottom:20}}>
              <div className="ex-card" role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")()=>exportAll("investors","word")}} onClick={()=>exportAll("investors","word")}><div className="ex-card-ico">📝🗜</div><div className="ex-card-t">Todos — Word ZIP</div><div className="ex-card-s">Un .doc por inversor en un ZIP.</div></div>
              <div className="ex-card" role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")()=>exportAll("investors","pdf_combined")}} onClick={()=>exportAll("investors","pdf_combined")}><div className="ex-card-ico">📄</div><div className="ex-card-t">Todos — PDF combinado</div><div className="ex-card-s">Un solo PDF con todos los inversores.</div></div>
            </div>
            <div className="sec-hdr" style={{marginBottom:8}}>🤖 Daily Summary — Prompt para Claude</div>
            <div className="card" style={{marginBottom:18,padding:"14px 18px"}}>
              <div style={{fontSize:12,color:"var(--dim)",marginBottom:10,lineHeight:1.6}}>
                Generá un prompt listo para pegar en Claude y obtener el <strong style={{color:"var(--cream)"}}>Daily Summary</strong> para el encabezado del schedule impreso.
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {getDayIds(config).map((d,di)=>(
                  <button key={d} className="btn bo bs" style={{fontSize:11,gap:6}} onClick={()=>exportSummaryPrompt(d)}>
                    <span style={{fontSize:13}}>📋</span>
                    {getDayShort(config)[d]||d}
                  </button>
                ))}
              </div>
            </div>
            <div className="sec-hdr" style={{marginBottom:8}}>🎯 Individual</div>
            <div className="g2">
              <div className="card">
                <div className="card-t">Compañías individuales</div>
                <div style={{maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                  {companies.filter(c=>meetings.some(m=>m.coId===c.id)).map(co=>(
                    <div key={co.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:"var(--ink3)",borderRadius:6,border:"1px solid rgba(255,255,255,.05)"}}>
                      <span style={{flex:1,fontSize:12,color:"var(--txt)"}}>{co.name}</span>
                      <span className="bdg bg-g">{(byCompany[co.id]||[]).length}</span>
                      <button className="btn bo bs" onClick={()=>exportCompany(co,"pdf")}>PDF</button>
                      <button className="btn bo bs" onClick={()=>exportCompany(co,"word")}>Word</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-t">Inversores individuales</div>
                <div style={{maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                  {investors.filter(inv=>meetings.some(m=>(m.invIds||[]).includes(inv.id))).map(inv=>(
                    <div key={inv.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:"var(--ink3)",borderRadius:6,border:"1px solid rgba(255,255,255,.05)"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:"var(--txt)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inv.name}</div>
                        <div style={{fontSize:10,color:"var(--dim)"}}>{inv.fund}</div>
                      </div>
                      <span className="bdg bg-g">{(byInvestor[inv.id]||[]).length}</span>
                      <button className="btn bo bs" onClick={()=>exportInvestor(inv,"pdf")}>PDF</button>
                      <button className="btn bo bs" onClick={()=>exportInvestor(inv,"word")}>Word</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>)}
        </div>
      )}

      {/* ════ HISTORICAL ANALYSIS ════ */}
      {tab==="historical"&&(
        <div>
          <h2 className="pg-h">Análisis Histórico</h2>
          <p className="pg-s">
            Compará ediciones anteriores con <strong style={{color:"var(--cream)"}}>la conferencia actual ({investors.length > 0 ? investors.length+" inversores cargados" : "sin inversores cargados aún"})</strong>.
            {investors.length===0&&<span style={{color:"var(--gold)"}}> ⚠ Primero cargá el archivo de la conferencia actual en la tab 📥 Cargar.</span>}
          </p>

          {/* ── Year upload cards ── */}
          <div className="card">
            <div className="card-t">📂 Cargar ediciones anteriores para comparar</div>
            <p style={{fontSize:12,color:"var(--dim)",marginBottom:14,lineHeight:1.6}}>
              Subí los Excel de ediciones anteriores (mismo formato). Se compararán contra los inversores actuales.
            </p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
              {["2022","2023","2024","2025"].map(yr=>{
                const loaded = historicalYears.find(y=>y.year===yr);
                return (
                  <div key={yr} style={{flex:"1 1 140px",minWidth:130,border:"1px solid rgba(30,90,176,"+(loaded?".4":".12")+")",borderRadius:8,padding:"12px 14px",background:loaded?"rgba(30,90,176,.07)":"transparent",cursor:"pointer",position:"relative"}}
                    onClick={()=>{ histFileRef.current.dataset.yr=yr; histFileRef.current.click(); }}>
                    <div style={{fontSize:18,marginBottom:3}}>{loaded?"✅":"📄"}</div>
                    <div style={{fontSize:13,fontWeight:700,color:"var(--cream)"}}>{yr}</div>
                    {loaded
                      ? <div style={{fontSize:11,color:"var(--grn)",marginTop:2}}>{loaded.investors.length} inversores</div>
                      : <div style={{fontSize:11,color:"var(--dim)",marginTop:2}}>Clic para subir</div>}
                    {loaded&&<button className="btn bd bs" style={{position:"absolute",top:6,right:6,padding:"2px 6px",fontSize:9}}
                      onClick={e=>{e.stopPropagation();setHistoricalYears(p=>p.filter(y=>y.year!==yr));}}>✕</button>}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>

              <input ref={histFileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}}
                onChange={e=>{const f=e.target.files?.[0]; if(f)parseHistoricalFile(f,histFileRef.current.dataset.yr||"?"); e.target.value="";}}/>
              <button className="btn bo bs" onClick={()=>{
                const yr=prompt("Año a cargar (ej: 2021):","2021");
                if(yr&&yr.trim()){histFileRef.current.dataset.yr=yr.trim();histFileRef.current.click();}
              }}>+ Otro año</button>
              {historicalYears.length>0&&<button className="btn bd bs" onClick={()=>setHistoricalYears([])}>✕ Limpiar todo</button>}
              {historicalYears.length>0&&investors.length>=0&&<button className="btn bo bs" onClick={()=>exportHistoricalHTML(historicalYears, investors, companies, meetings)}>📊 Exportar informe HTML</button>}
            </div>
          </div>

          {historicalYears.length>=1&&investors.length>=0&&(()=>{
            /* ── Key function: match investor across years ── */
            const invKey = inv => {
              const e = (inv.email||"").trim().toLowerCase();
              if(e) return "email:"+e;
              return "name:"+(normalizeFund((inv.name||""))+"|||"+normalizeFund((inv.fund||"")));
            };

            /* Current year investors keyed */
            const currentKeys = new Set(investors.map(invKey));

            /* Build combined dataset: historicalYears + current year */
            const currentYearLabel = "Actual";
            const allDatasets = [
              ...historicalYears,
              {year: currentYearLabel, fileName:"actual", investors: investors.map(inv=>({
                name:inv.name, fund:inv.fund, email:(inv.email||"").toLowerCase().trim(),
                companies: inv.companies||[]
              }))}
            ].sort((a,b)=>a.year===currentYearLabel?1:b.year===currentYearLabel?-1:a.year.localeCompare(b.year));

            const allYears = allDatasets.map(y=>y.year);

            /* Per-year key sets */
            const yearKeySets = {};
            allDatasets.forEach(({year,investors:invs})=>{
              yearKeySets[year] = new Set(invs.map(invKey));
            });

            /* Investor → years map */
            const invYearMap = {};
            allDatasets.forEach(({year,investors:invs})=>{
              invs.forEach(inv=>{
                const k=invKey(inv);
                if(!invYearMap[k]) invYearMap[k]={info:inv,years:new Set()};
                invYearMap[k].years.add(year);
              });
            });

            /* Per-year stats vs current */
            const COLORS=["#9b59b6","#e67e22","#3399ff","#23a29e","#1e5ab0","#3a8c5c"];

            /* Company demand */
            const coDemand = {};
            COMPANIES_INIT.forEach(c=>{coDemand[c.id]={};});
            allDatasets.forEach(({year,investors:invs})=>{
              invs.forEach(inv=>{
                (inv.companies||[]).forEach(coId=>{
                  if(coDemand[coId]) coDemand[coId][year]=(coDemand[coId][year]||0)+1;
                });
              });
            });

            /* Top companies */
            const coTotals = COMPANIES_INIT.map(c=>({
              ...c,
              total: allYears.reduce((s,yr)=>s+(coDemand[c.id][yr]||0),0),
              perYear: allYears.map(yr=>coDemand[c.id][yr]||0)
            })).filter(c=>c.total>0).sort((a,b)=>b.total-a.total).slice(0,14);
            const maxCo = Math.max(...coTotals.map(c=>c.total),1);

            /* Repeaters (appear in any past year AND current) */
            const returningToCurrent = Object.values(invYearMap).filter(v=>
              v.years.has(currentYearLabel) && v.years.size>1
            ).sort((a,b)=>b.years.size-a.years.size);

            /* Missing: were in a previous year but NOT in current */
            const missingFromCurrent = {};
            historicalYears.forEach(({year,investors:invs})=>{
              invs.forEach(inv=>{
                const k=invKey(inv);
                if(!currentKeys.has(k)){
                  if(!missingFromCurrent[k]) missingFromCurrent[k]={info:inv,years:new Set()};
                  missingFromCurrent[k].years.add(year);
                }
              });
            });
            const missingList = Object.values(missingFromCurrent).sort((a,b)=>b.years.size-a.years.size);

            const BAR_H=22, BAR_GAP=6, LABEL_W=100;
            const maxTotal = Math.max(...allDatasets.map(d=>d.investors.length),1);

            return (
              <div style={{display:"flex",flexDirection:"column",gap:16}}>

                {/* ── Summary stats ── */}
                <div className="stats">
                  {allDatasets.map(({year,investors:invs},i)=>{
                    const prevYrs = allYears.slice(0,i);
                    const prevKeys = new Set(prevYrs.flatMap(y=>[...yearKeySets[y]]));
                    const myKeys = [...yearKeySets[year]];
                    const returning = myKeys.filter(k=>prevKeys.has(k)).length;
                    const isCurrentYr = year===currentYearLabel;
                    return (
                      <div key={year} className="stat" style={{minWidth:110,border:isCurrentYr?"1px solid rgba(30,90,176,.3)":"none",borderRadius:isCurrentYr?8:0,padding:isCurrentYr?"8px 10px":"0"}}>
                        <div className="sl" style={{color:isCurrentYr?"var(--gold)":undefined}}>{isCurrentYr?"📍 Actual":year}</div>
                        <div className="sv">{invs.length}</div>
                        {returning>0&&<div style={{fontSize:10,color:"var(--gold)",marginTop:2}}>↩ {returning} volvieron</div>}
                        {isCurrentYr&&returningToCurrent.length>0&&<div style={{fontSize:10,color:"var(--grn)",marginTop:2}}>✓ {returningToCurrent.length} históricos</div>}
                      </div>
                    );
                  })}
                  <div className="stat" style={{minWidth:110}}>
                    <div className="sl">Únicos históricos</div>
                    <div className="sv">{Object.keys(invYearMap).length}</div>
                  </div>
                  <div className="stat" style={{minWidth:110,background:"rgba(231,76,60,.06)",borderRadius:6}}>
                    <div className="sl" style={{color:"#e74c3c"}}>No volvieron</div>
                    <div className="sv" style={{color:"#e74c3c"}}>{missingList.length}</div>
                    <div style={{fontSize:10,color:"var(--dim)",marginTop:2}}>vs años anteriores</div>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  {/* ── Attendance bars ── */}
                  <div className="card">
                    <div className="card-t">👥 Participación por edición</div>
                    <svg width="100%" viewBox={"0 0 400 "+((BAR_H+BAR_GAP)*allDatasets.length+24)} style={{overflow:"visible"}}>
                      {allDatasets.map(({year,investors:invs},i)=>{
                        const prevYrs = allYears.slice(0,i);
                        const prevKeys = new Set(prevYrs.flatMap(y=>[...yearKeySets[y]]));
                        const myKeys = [...yearKeySets[year]];
                        const returning = myKeys.filter(k=>prevKeys.has(k)).length;
                        const newCount = invs.length - returning;
                        const retW=(returning/maxTotal)*270;
                        const newW=(newCount/maxTotal)*270;
                        const y2=i*(BAR_H+BAR_GAP);
                        const isAct=year===currentYearLabel;
                        return (
                          <g key={year}>
                            <text x={LABEL_W-4} y={y2+BAR_H/2+4} textAnchor="end" fontSize="11" fill={isAct?"#c9a227":"#7a8fa8"} fontFamily="IBM Plex Mono,monospace" fontWeight={isAct?"700":"400"}>{isAct?"Actual":year}</text>
                            <rect x={LABEL_W} y={y2} width={newW} height={BAR_H} rx="3" fill={isAct?"#3399ff":"#4a6a9c"} opacity="0.85"/>
                            <rect x={LABEL_W+newW} y={y2} width={retW} height={BAR_H} rx="3" fill="#23a29e" opacity="0.8"/>
                            <text x={LABEL_W+newW+retW+6} y={y2+BAR_H/2+4} fontSize="11" fill={isAct?"#c9a227":"#2d3f5e"} fontFamily="IBM Plex Mono,monospace" fontWeight="700">{invs.length}</text>
                          </g>
                        );
                      })}
                      <g transform={"translate("+LABEL_W+","+(allDatasets.length*(BAR_H+BAR_GAP)+6)+")"}>
                        <rect width="10" height="10" rx="2" fill="#4a6a9c" opacity="0.85"/>
                        <text x="14" y="9" fontSize="9" fill="#7a8fa8" fontFamily="IBM Plex Mono">Nuevos</text>
                        <rect x="60" width="10" height="10" rx="2" fill="#23a29e" opacity="0.8"/>
                        <text x="74" y="9" fontSize="9" fill="#7a8fa8" fontFamily="IBM Plex Mono">Volvieron</text>
                      </g>
                    </svg>
                  </div>

                  {/* ── Retention to current ── */}
                  <div className="card">
                    <div className="card-t">🔄 % que vuelve al año actual</div>
                    {historicalYears.length===0
                      ? <div style={{color:"var(--dim)",fontSize:12,padding:"20px 0",textAlign:"center"}}>Cargá años anteriores.</div>
                      : (()=>{
                          const pairs = historicalYears.map(({year,investors:invs})=>{
                            const prevKeys2 = new Set(invs.map(invKey));
                            const ret = [...currentKeys].filter(k=>prevKeys2.has(k)).length;
                            const pct = invs.length>0?Math.round(ret/invs.length*100):0;
                            return {year, ret, total:invs.length, pct};
                          }).sort((a,b)=>a.year.localeCompare(b.year));
                          return (
                            <svg width="100%" viewBox={"0 0 360 "+(pairs.length*(BAR_H+BAR_GAP)+30)} style={{overflow:"visible"}}>
                              {pairs.map(({year,ret,total,pct},i)=>{
                                const bw=(pct/100)*230;
                                const y2=i*(BAR_H+BAR_GAP);
                                const col=pct>=50?"#3a8c5c":pct>=25?"#e67e22":"#e74c3c";
                                return (
                                  <g key={year}>
                                    <text x={78} y={y2+BAR_H/2+4} textAnchor="end" fontSize="11" fill="#7a8fa8" fontFamily="IBM Plex Mono">{year} →</text>
                                    <rect x={82} y={y2} width={bw||2} height={BAR_H} rx="3" fill={col} opacity="0.8"/>
                                    <text x={82+bw+6} y={y2+BAR_H/2+4} fontSize="11" fill="#2d3f5e" fontFamily="IBM Plex Mono" fontWeight="700">{pct}%</text>
                                    <text x={82+bw+44} y={y2+BAR_H/2+4} fontSize="10" fill="#7a8fa8" fontFamily="IBM Plex Mono">({ret}/{total})</text>
                                  </g>
                                );
                              })}
                              <text x={82} y={pairs.length*(BAR_H+BAR_GAP)+16} fontSize="10" fill="#7a8fa8" fontFamily="IBM Plex Mono">de cada año volvieron al año actual</text>
                            </svg>
                          );
                        })()
                    }
                  </div>
                </div>

                {/* ── Missing investors (were before, not now) ── */}
                {missingList.length>0&&(
                  <div className="card">
                    <div className="card-t" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span>⚠️ Inversores que no volvieron este año ({missingList.length})</span>
                      <button className="btn bo bs" style={{fontSize:10}} onClick={()=>{
                        const lines=["Nombre,Fondo,Email,Años",...missingList.map(({info,years})=>`"${info.name}","${info.fund||""}","${info.email||""}",[...years].sort().join("+")`)].join("\n");
                        const b=new Blob([lines],{type:"text/csv"});const u=URL.createObjectURL(b);
                        const a=document.createElement("a");a.href=u;a.download="no_volvieron.csv";a.click();
                      }}>⬇ CSV</button>
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <table className="tbl">
                        <thead><tr><th>#</th><th>Nombre</th><th>Fondo</th><th>Email</th><th>Estuvo en</th></tr></thead>
                        <tbody>
                          {missingList.slice(0,50).map(({info,years},i)=>(
                            <tr key={i}>
                              <td style={{fontSize:11,color:"var(--dim)"}}>{i+1}</td>
                              <td style={{fontSize:12,fontWeight:600}}>{info.name}</td>
                              <td style={{fontSize:11,color:"var(--dim)"}}>{info.fund||"—"}</td>
                              <td style={{fontSize:10,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>{info.email||"—"}</td>
                              <td>{[...years].sort().map(yr=><span key={yr} className="bdg bg-g" style={{marginRight:3,fontSize:9}}>{yr}</span>)}</td>
                            </tr>
                          ))}
                          {missingList.length>50&&<tr><td colSpan={5} style={{fontSize:11,color:"var(--dim)",textAlign:"center",padding:"8px 0"}}>...y {missingList.length-50} más. Exportá CSV para ver todos.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Returning investors ── */}
                {returningToCurrent.length>0&&(
                  <div className="card">
                    <div className="card-t">🏆 Inversores que volvieron este año ({returningToCurrent.length})</div>
                    <div style={{overflowX:"auto"}}>
                      <table className="tbl">
                        <thead><tr><th>#</th><th>Nombre</th><th>Fondo</th><th>Email</th><th>Ediciones</th></tr></thead>
                        <tbody>
                          {returningToCurrent.map(({info,years},i)=>(
                            <tr key={i}>
                              <td style={{fontSize:11,color:"var(--dim)"}}>{i+1}</td>
                              <td style={{fontSize:12,fontWeight:600}}>{info.name}</td>
                              <td style={{fontSize:11,color:"var(--dim)"}}>{info.fund||"—"}</td>
                              <td style={{fontSize:10,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>{info.email||"—"}</td>
                              <td style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                                {[...years].sort().map(yr=><span key={yr} className={"bdg "+(yr===currentYearLabel?"bg-b":"bg-g")} style={{fontSize:9}}>{yr===currentYearLabel?"Actual":yr}</span>)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Company demand ── */}
                {coTotals.length>0&&(
                  <div className="card">
                    <div className="card-t">🏢 Demanda por compañía — evolución histórica</div>
                    <div style={{overflowX:"auto"}}>
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th>Compañía</th>
                            {allYears.map(yr=><th key={yr} style={{color:yr===currentYearLabel?"var(--gold)":undefined}}>{yr===currentYearLabel?"Actual":yr}</th>)}
                            <th>Tendencia</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coTotals.map(co=>{
                            const vals=allYears.map(yr=>coDemand[co.id][yr]||0);
                            const histVals=vals.slice(0,-1);
                            const curVal=vals[vals.length-1];
                            const prevVal=histVals.length>0?histVals[histVals.length-1]:null;
                            const trend=prevVal===null?"—":curVal>prevVal?"📈":curVal<prevVal?"📉":"➡";
                            const sparkW=56, sparkH=16;
                            const maxV=Math.max(...vals,1);
                            const pts=vals.map((v,i)=>`${(i/(vals.length-1||1))*sparkW},${sparkH-(v/maxV)*sparkH}`).join(" ");
                            return (
                              <tr key={co.id}>
                                <td style={{fontSize:12}}><strong>{co.ticker}</strong> <span style={{fontSize:10,color:"var(--dim)"}}>{co.name}</span></td>
                                {vals.map((v,i)=>{
                                  const isAct=allYears[i]===currentYearLabel;
                                  const prevV=i>0?vals[i-1]:null;
                                  const diff=prevV!==null?v-prevV:null;
                                  return (
                                    <td key={i} style={{textAlign:"center",fontSize:12,fontWeight:isAct?700:400,color:isAct?v>0?"var(--gold)":"var(--dim)":v>0?"var(--txt)":"var(--dim)"}}>
                                      {v>0?v:"—"}
                                      {diff!==null&&diff!==0&&<sup style={{fontSize:9,color:diff>0?"var(--grn)":"#e74c3c",marginLeft:2}}>{diff>0?"+"+diff:diff}</sup>}
                                    </td>
                                  );
                                })}
                                <td>
                                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                                    {vals.length>1&&(
                                      <svg width={sparkW} height={sparkH}>
                                        <polyline points={pts} fill="none" stroke="#3399ff" strokeWidth="1.5" strokeLinejoin="round"/>
                                        <circle cx={(vals.length-1)/(vals.length-1||1)*sparkW} cy={sparkH-(vals[vals.length-1]/maxV)*sparkH} r="2.5" fill="#c9a227"/>
                                      </svg>
                                    )}
                                    <span style={{fontSize:12}}>{trend}</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── New this year (never seen before) ── */}
                {(()=>{
                  const allPrevKeys = new Set(historicalYears.flatMap(({investors:invs})=>invs.map(invKey)));
                  const brandNew = investors.filter(inv=>!allPrevKeys.has(invKey({name:inv.name,fund:inv.fund,email:(inv.email||"").toLowerCase()}))); 
                  return brandNew.length>0?(
                    <div className="card">
                      <div className="card-t">🌟 Nuevos este año — nunca estuvieron ({brandNew.length})</div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5,maxHeight:200,overflowY:"auto"}}>
                        {brandNew.map((inv,i)=>(
                          <span key={i} className="tag" style={{fontSize:11}}>{inv.name}{inv.fund?" · "+inv.fund:""}</span>
                        ))}
                      </div>
                    </div>
                  ):null;
                })()}

              </div>
            );
          })()}

          {historicalYears.length===0&&(
            <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)"}}>
              <div style={{fontSize:40,marginBottom:12}}>📊</div>
              <div style={{fontSize:14,color:"var(--cream)",marginBottom:6}}>Cargá al menos un año anterior para ver la comparación</div>
              <div style={{fontSize:12}}>Todo se compara contra los {investors.length} inversores del año actual.</div>
            </div>
          )}
        </div>
      )}

      {tab==="roadshow"&&(()=>{
        const lsCont=(config.contacts||[])[roadshow.trip.lsContactIdx||0]||{};
        // Helper to patch a company field inline (used in meeting modal)
        window.__rsCoPatch=(coId,field,val)=>{const nc=roadshow.companies.map(c=>c.id===coId?{...c,[field]:val}:c);saveRoadshow({...roadshow,companies:nc});};
        function upTrip(f,v){saveRoadshow({...roadshow,trip:{...roadshow.trip,[f]:v}});}
        function saveMtg(m){const ex=roadshow.meetings.find(x=>x.id===m.id);const ms=ex?roadshow.meetings.map(x=>x.id===m.id?m:x):[...roadshow.meetings,m];saveRoadshow({...roadshow,meetings:ms});setRsMtgModal(null);}
        function delMtg(id){saveRoadshow({...roadshow,meetings:roadshow.meetings.filter(m=>m.id!==id)});setRsMtgModal(null);}
        const confirmed=roadshow.meetings.filter(m=>m.status==="confirmed").length;
        const tentative=roadshow.meetings.filter(m=>m.status==="tentative").length;
        return(
        <div>
          <h2 className="pg-h">🗺️ Buenos Aires Roadshow</h2>
          <p className="pg-s">Organizá la agenda para inversores que visitan Argentina — reuniones corporativas, logística y más.</p>

          {/* Trip Setup */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-t">🧳 Datos del Viaje</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:10}}>
              <div><div className="lbl">Cliente / Inversor</div><input className="inp" value={roadshow.trip.clientName} onChange={e=>upTrip("clientName",e.target.value)} placeholder="John Smith"/></div>
              <div><div className="lbl">Fondo / Firma</div><input className="inp" value={roadshow.trip.fund} onChange={e=>upTrip("fund",e.target.value)} placeholder="Merrill Lynch AM"/></div>
              <div><div className="lbl">Hotel</div><input className="inp" value={roadshow.trip.hotel} onChange={e=>upTrip("hotel",e.target.value)} placeholder="Holiday Inn"/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
              <div><div className="lbl">Llegada</div>
                <DayDateInput day={{date:roadshow.trip.arrivalDate,short:roadshow.trip.arrivalDate,long:""}} di={0} onChange={nd=>upTrip("arrivalDate",nd.date)}/></div>
              <div><div className="lbl">Salida</div>
                <DayDateInput day={{date:roadshow.trip.departureDate,short:roadshow.trip.departureDate,long:""}} di={1} onChange={nd=>upTrip("departureDate",nd.date)}/></div>
              <div><div className="lbl">Duración reunión</div>
                <select className="sel" value={roadshow.trip.meetingDuration||60} onChange={e=>upTrip("meetingDuration",parseInt(e.target.value))}>
                  {[[30,"30 min"],[45,"45 min"],[60,"1 hora"],[90,"1h 30min"],[120,"2 horas"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select></div>
              <div><div className="lbl">Contacto LS</div>
                <select className="sel" value={roadshow.trip.lsContactIdx||0} onChange={e=>upTrip("lsContactIdx",parseInt(e.target.value))}>
                  {(config.contacts||[]).length?config.contacts.map((c,i)=><option key={i} value={i}>{c.name}</option>):<option value={0}>Configurar en ⚙ Config</option>}
                </select></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10,marginBottom:10}}>
              <div><div className="lbl">Dirección de nuestras oficinas</div><input className="inp" value={roadshow.trip.officeAddress} onChange={e=>upTrip("officeAddress",e.target.value)} placeholder="Arenales 707, 6° Piso, CABA"/></div>
              <div><div className="lbl">Notas</div><input className="inp" value={roadshow.trip.notes} onChange={e=>upTrip("notes",e.target.value)} placeholder="Sector de interés..."/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center",marginBottom:10,background:"rgba(30,90,176,.03)",border:"1px solid rgba(30,90,176,.1)",borderRadius:7,padding:"10px 12px"}}>
              <div>
                <div className="lbl" style={{marginBottom:3}}>🗺️ Google Maps API Key <span style={{fontWeight:400,color:"var(--dim)"}}>(opcional — para calcular tiempos automáticamente)</span></div>
                <input className="inp" style={{fontFamily:"IBM Plex Mono,monospace",fontSize:11}} type="password"
                  value={roadshow.trip.mapsApiKey||""} onChange={e=>upTrip("mapsApiKey",e.target.value)}
                  placeholder="AIza..."/>
              </div>
              <div style={{fontSize:10,color:"var(--dim)",lineHeight:1.5,maxWidth:200}}>
                Sin key: abre Google Maps en el navegador.<br/>
                Con key: calcula tiempos automáticamente.<br/>
                <a href="https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com" target="_blank" style={{color:"var(--gold)"}}>Activar API →</a>
              </div>
            </div>
            {/* Visitors */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <div className="lbl" style={{margin:0}}>👥 Visitantes del fondo</div>
                <button className="btn bo bs" style={{fontSize:9,padding:"2px 8px"}} onClick={()=>{const v=(roadshow.trip.visitors||[]);saveRoadshow({...roadshow,trip:{...roadshow.trip,visitors:[...v,{name:"",title:"",email:""}]}});}}>+ Agregar</button>
              </div>
              {(roadshow.trip.visitors||[]).map((v,vi)=>(
                <div key={vi} style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                  <input className="inp" style={{flex:2,fontSize:11,padding:"3px 7px"}} value={v.name} placeholder="Nombre" onChange={e=>{const vs=[...(roadshow.trip.visitors||[])];vs[vi]={...vs[vi],name:e.target.value};upTrip("visitors",vs);}}/>
                  <input className="inp" style={{flex:1.5,fontSize:11,padding:"3px 7px"}} value={v.title||""} placeholder="Cargo / Fund" onChange={e=>{const vs=[...(roadshow.trip.visitors||[])];vs[vi]={...vs[vi],title:e.target.value};upTrip("visitors",vs);}}/>
                  <input className="inp" style={{flex:2,fontSize:11,padding:"3px 7px"}} value={v.email||""} placeholder="email@fondo.com" onChange={e=>{const vs=[...(roadshow.trip.visitors||[])];vs[vi]={...vs[vi],email:e.target.value};upTrip("visitors",vs);}}/>
                  <button aria-label="Eliminar visitante" className="btn bd bs" style={{fontSize:9,padding:"2px 6px",flexShrink:0}} onClick={()=>{const vs=(roadshow.trip.visitors||[]).filter((_,j)=>j!==vi);upTrip("visitors",vs);}}>✕</button>
                </div>
              ))}
              {!(roadshow.trip.visitors||[]).length&&<div style={{fontSize:11,color:"var(--dim)"}}>Agregá los representantes del fondo que visitan Argentina — aparecen en los emails y el ICS.</div>}
            </div>
            {/* Email parser */}
            <div style={{borderTop:"1px solid rgba(30,90,176,.08)",paddingTop:10}}>
              <button className="btn bo bs" style={{fontSize:10,gap:5,marginBottom:rsShowParser?8:0}} onClick={()=>setRsShowParser(s=>!s)}>
                {rsShowParser?"▲ Cerrar":"▼ 📧 Parsear email del inversor"}
              </button>
              {rsShowParser&&(
                <div style={{marginTop:6}}>
                  <textarea className="inp" style={{width:"100%",minHeight:110,fontSize:11,fontFamily:"monospace",marginBottom:6,resize:"vertical"}}
                    placeholder={"Pegá el email del inversor aquí...\nEj: We will be arriving on 18 April and leaving on 24 April...\nBanco Macro\nYPF\n..."}
                    value={rsEmailParser} onChange={e=>setRsEmailParser(e.target.value)}/>
                  <button className="btn bg bs" style={{fontSize:11,gap:5}} onClick={()=>{
                    if(!rsEmailParser.trim()) return;
                    const result=handleRsEmailParse(rsEmailParser);
                    const{patchTrip,matchedCos}=result;
                    let msg="";
                    const newTrip={...roadshow.trip,...patchTrip};
                    if(patchTrip.arrivalDate) msg+=`✅ Fechas: ${patchTrip.arrivalDate} al ${patchTrip.departureDate}\n`;
                    if(patchTrip.hotel) msg+=`✅ Hotel: ${patchTrip.hotel}\n`;
                    if(matchedCos.length) msg+=`✅ ${matchedCos.length} empresa(s) encontrada(s): ${matchedCos.map(c=>c.name).join(", ")}`;
                    const newCos=[...roadshow.companies,...matchedCos];
                    saveRoadshow({...roadshow,trip:newTrip,companies:newCos});
                    alert(msg||"No se encontraron datos para extraer. Verificá el formato del email.");
                    if(msg){setRsShowParser(false);setRsEmailParser("");}
                  }}>🔍 Extraer fechas, hotel y empresas</button>
                </div>
              )}
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{display:"flex",gap:0,marginBottom:14,borderBottom:"1px solid rgba(30,90,176,.1)"}}>
            {[["schedule","📅 Agenda"],["companies","🏢 Empresas"],["travel","🗺️ Recorrido"],["emails","✉️ Emails"],["export","📄 Exportar"]].map(([id,lbl])=>(
              <button key={id} className={`ntab${rsSubTab===id?" on":""}`} style={{height:38,fontSize:10}} onClick={()=>setRsSubTab(id)}>{lbl}</button>
            ))}
            <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10,paddingBottom:4,paddingRight:4}}>
              <span style={{fontSize:10,color:"var(--grn)",fontFamily:"IBM Plex Mono,monospace"}}>{confirmed} ✓</span>
              <span style={{fontSize:10,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>{tentative} ⏳</span>
            </div>
          </div>

          {/* AGENDA */}
          {rsSubTab==="schedule"&&(
            <div>
              {/* Legend + add button */}
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
                {[...new Set([...roadshow.companies.filter(c=>c.active).map(c=>c.sector),"LS Internal"])].map(s=>(
                  <div key={s} style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>
                    <div style={{width:7,height:7,borderRadius:1,background:RS_CLR[s]||"#666"}}/>
                    {s}
                  </div>
                ))}
                <div style={{marginLeft:"auto"}}>
                  <button className="btn bg bs" style={{fontSize:9,gap:4}} onClick={()=>{const firstWork=tripDays.find(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;})||tripDays[0];if(!firstWork){alert("Configurá las fechas del viaje primero.");return;}setRsMtgModal({date:firstWork,hour:9,meeting:null});}}>+ Nueva reunión</button>
                  <button className="btn bo bs" style={{fontSize:9,gap:4}} onClick={()=>rsMtgsExcelRef.current?.click()}>📥 Importar Excel</button>
                  {roadshow.meetings.length>0&&<button className="btn bd bs" style={{fontSize:9,gap:4}} onClick={()=>{if(confirm(`¿Borrar las ${roadshow.meetings.length} reunión(es) del roadshow? Esta acción no se puede deshacer.`))saveRoadshow({...roadshow,meetings:[]});}}>🗑 Borrar todo</button>}
                  <button className="btn bo bs" style={{fontSize:9,gap:4,opacity:.7}} title="Columnas: Fecha | Día | Hora | Compañía | Tipo | Dirección/Lugar | Estado | Notas" onClick={()=>{
                    const header=["Fecha","Día","Hora","Compañía","Tipo","Dirección / Lugar","Estado","Notas"];
                    const rows=[
                      ["20/04/2026","Lun",9,"TGS","Company Visit","Cecilia Grierson 355, Piso 26, CABA","✅ Confirmado","Rodrigo Nistor"],
                      ["20/04/2026","Lun",10.5,"Pampa Energía","Company Visit","Maipú 1, CABA","✅ Confirmado","Rodrigo Nistor"],
                      ["21/04/2026","Mar",9,"YPF","Company Visit","Macacha Güemes 515, CABA","✅ Confirmado","Rodrigo Nistor"],
                    ];
                    const ws=XLSX.utils.aoa_to_sheet([header,...rows]);
                    // Add data validation dropdown for Hora column (col C = index 2)
                    // Hours 8-20 in 30min intervals as numbers (9, 9.5, 10, 10.5...)
                    const VALID_HOURS=[8,8.5,9,9.5,10,10.5,11,11.5,12,12.5,13,13.5,14,14.5,15,15.5,16,16.5,17,17.5,18,18.5,19,19.5,20];
                    const hourFormula='"'+VALID_HOURS.join(",")+'"';
                    ws["!dataValidation"]=[
                      {sqref:"C2:C100",type:"list",formula1:hourFormula,showDropDown:false,showErrorMessage:true,
                       errorTitle:"Hora inválida",error:"Usá el dropdown: 9=9am, 9.5=9:30am, 13=1pm, 13.5=1:30pm, etc."}
                    ];
                    // Format hora cells as numbers
                    for(let r=1;r<10;r++){const cell=XLSX.utils.encode_cell({r,c:2});if(ws[cell])ws[cell].t="n";}
                    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Reuniones");
                    XLSX.writeFile(wb,"Plantilla_Reuniones.xlsx");
                  }}>📋 Plantilla</button>
                </div>
              </div>

              {/* Calendar grid */}
              {tripDays.length===0?(
                <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)"}}>
                  <div style={{fontSize:32,marginBottom:8}}>📅</div>
                  <div style={{fontSize:14,color:"var(--cream)"}}>Configurá las fechas del viaje para ver el calendario</div>
                </div>
              ):(
                <div style={{overflowX:"auto",borderRadius:8,border:"1px solid rgba(30,90,176,.1)",boxShadow:"0 1px 4px rgba(30,90,176,.05)",marginBottom:14}}>
                  <table style={{borderCollapse:"collapse",width:"100%"}}>
                    <colgroup>
                      <col style={{width:46}}/>
                      {tripDays.map(d=><col key={d} style={{minWidth:92}}/>)}
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{background:"rgba(30,90,176,.04)",padding:"5px 3px",borderBottom:"2px solid rgba(30,90,176,.12)",fontSize:8,color:"var(--dim)"}}></th>
                        {tripDays.map(date=>{
                          const d=new Date(date+"T12:00:00");
                          const isWE=d.getDay()===0||d.getDay()===6;
                          const DN=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
                          return(
                            <th key={date} style={{background:isWE?"rgba(30,90,176,.02)":"#1e5ab0",color:isWE?"var(--dim)":"#fff",borderBottom:"2px solid rgba(30,90,176,.12)",padding:"4px 3px",textAlign:"center"}}>
                              <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:7.5,letterSpacing:".08em",marginBottom:1}}>{DN[d.getDay()]}</div>
                              <div style={{fontSize:14,fontWeight:700,lineHeight:1}}>{d.getDate()}</div>
                              <div style={{fontSize:7,opacity:.75}}>Abr</div>
                            </th>);
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {(()=>{
                        // Build skip map: cells occupied by a rowspan from a meeting above
                        // skip[date][slotIndex] = true if covered by a prior rowspan
                        const skip={};
                        tripDays.forEach(date=>{skip[date]={};});
                        ROADSHOW_HOURS.forEach((h,hi)=>{
                          tripDays.forEach(date=>{
                            if(skip[date][hi]) return;
                            const mtg=rsBySlot[`${date}-${h}`];
                            if(mtg){
                              const rows=Math.max(1,Math.round((mtg.duration||60)/30));
                              for(let r=1;r<rows;r++){
                                if(hi+r<ROADSHOW_HOURS.length) skip[date][hi+r]=true;
                              }
                            }
                          });
                        });
                        return ROADSHOW_HOURS.map((h,hi)=>(
                          <tr key={h} style={{height:28}}>
                            <td style={{background:"rgba(30,90,176,.02)",borderRight:"2px solid rgba(30,90,176,.07)",textAlign:"right",padding:"2px 5px 2px 2px",fontSize:8.5,color:h%1===0?"var(--dim)":"rgba(120,140,170,.4)",fontFamily:"IBM Plex Mono,monospace",verticalAlign:"top",paddingTop:3,whiteSpace:"nowrap"}}>
                              {h%1===0?fmtHour(h):"·"}
                            </td>
                            {tripDays.map(date=>{
                              if(skip[date][hi]) return null;
                              const d=new Date(date+"T12:00:00");
                              const isWE=d.getDay()===0||d.getDay()===6;
                              const mtg=rsBySlot[`${date}-${h}`];
                              const co=mtg?.type==="company"?rsCoById.get(mtg.companyId):null;
                              const clr=mtg?(mtg.type==="company"?(RS_CLR[co?.sector]||"#666"):"#23a29e"):null;
                              const lbl=mtg?(mtg.type==="company"?(co?.ticker||"?"):(mtg.lsType?.split(" – ").pop()?.slice(0,9)||mtg.title?.slice(0,9)||"Int")):"";
                              const rows=mtg?Math.max(1,Math.round((mtg.duration||60)/30)):1;
                              const rowH=rows*28;
                              return(
                                <td key={date}
                                  rowSpan={rows}
                                  onClick={()=>!isWE&&setRsMtgModal({date,hour:h,meeting:mtg||null})}
                                  style={{border:"1px solid rgba(30,90,176,.05)",background:isWE?"rgba(0,0,0,.015)":mtg?`${clr}18`:"transparent",cursor:isWE?"default":"pointer",padding:mtg?2:1,verticalAlign:"top",height:mtg?rowH:28}}>
                                  {mtg&&<div style={{background:clr,color:"#fff",borderRadius:4,padding:"3px 5px",fontSize:9,fontWeight:700,height:rowH-6,overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"space-between",gap:1}}>
                                    <div style={{display:"flex",alignItems:"center",gap:3,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                                      <span>{lbl}</span>
                                      {mtg.status==="confirmed"&&<span style={{fontSize:7}}>✓</span>}
                                      {mtg.status==="cancelled"&&<span style={{fontSize:7,opacity:.7}}>✗</span>}
                                    </div>
                                    {rows>=2&&<div style={{fontSize:7.5,opacity:.8,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{fmtHour(h)}–{fmtHour(h+(mtg.duration||60)/60)}</div>}
                                  </div>}
                                  {!mtg&&!isWE&&(()=>{
                                  // Check if this is a gap slot between two meetings — show travel info
                                  const dayMtgsSorted=[...(roadshow.meetings||[])].filter(m=>m.date===date&&m.status!=="cancelled").sort((a,b)=>a.hour-b.hour);
                                  const prevMtgIdx=dayMtgsSorted.findIndex(m=>{
                                    const mEnd=m.hour+(m.duration||60)/60;
                                    return mEnd<=h && (m.hour+(m.duration||60)/60)===h;
                                  });
                                  // Find which pair index this gap belongs to
                                  let travelInfo=null;
                                  for(let pi=0;pi<dayMtgsSorted.length-1;pi++){
                                    const mA=dayMtgsSorted[pi];
                                    const mB=dayMtgsSorted[pi+1];
                                    const aEnd=mA.hour+(mA.duration||60)/60;
                                    // This slot is in the gap between mA and mB
                                    if(h>=aEnd&&h<mB.hour){
                                      const dayT=travelCache[date]||{};
                                      travelInfo=dayT[`${date}-${pi}`]||null;
                                      // Only show on first gap slot
                                      if(h===aEnd) break;
                                      else {travelInfo=null;break;}
                                    }
                                  }
                                  return travelInfo?(
                                    <div style={{fontSize:7.5,color:"#23a29e",fontFamily:"IBM Plex Mono,monospace",padding:"1px 3px",lineHeight:1.3,overflow:"hidden",whiteSpace:"nowrap"}}>
                                      🚗 {travelInfo.durationText}
                                    </div>
                                  ):(
                                    <div style={{fontSize:11,color:"rgba(30,90,176,.08)",textAlign:"center",lineHeight:"24px",userSelect:"none"}}>+</div>
                                  );
                                })()}
                                </td>);
                            })}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Meeting list */}
              {roadshow.meetings.length>0&&(
                <div>
                  <div className="sec-hdr" style={{marginBottom:8}}>📋 Todas las reuniones</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    {[...roadshow.meetings].sort((a,b)=>a.date.localeCompare(b.date)||a.hour-b.hour).map(m=>{
                      const co=m.type==="company"?rsCoById.get(m.companyId):null;
                      const clr=m.type==="company"?(RS_CLR[co?.sector]||"#666"):"#23a29e";
                      const d=new Date(m.date+"T12:00:00");
                      const dayStr=d.toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"});
                      const locL=m.location==="ls_office"?"LS":m.location==="hq"?(co?co.ticker+" HQ":"HQ"):(m.locationCustom||"Otro");
                      return(
                        <div key={m.id} style={{border:`1px solid ${clr}44`,borderRadius:7,padding:"8px 11px",background:`${clr}08`,display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}
                          onClick={()=>setRsMtgModal({date:m.date,hour:m.hour,meeting:m})}>
                          <div style={{width:34,height:34,borderRadius:6,background:clr,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:8.5,fontWeight:700,fontFamily:"IBM Plex Mono,monospace",textAlign:"center",flexShrink:0,lineHeight:1.2}}>{co?.ticker||"LS"}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:700,color:"var(--cream)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{co?co.name:(m.lsType||m.title||"Reunión")}</div>
                            <div style={{fontSize:10,color:"var(--dim)",marginTop:1}}>{dayStr} · {m.hour}:00 · {locL}</div>
                          </div>
                          <div style={{fontSize:9,padding:"2px 6px",borderRadius:4,flexShrink:0,fontFamily:"IBM Plex Mono,monospace",background:m.status==="confirmed"?"rgba(58,140,92,.12)":m.status==="cancelled"?"rgba(214,68,68,.10)":"rgba(30,90,176,.08)",color:m.status==="confirmed"?"var(--grn)":m.status==="cancelled"?"var(--red)":"var(--dim)"}}>
                            {m.status==="confirmed"?"✓":m.status==="cancelled"?"✗":"⏳"}
                          </div>
                        </div>);
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EMPRESAS */}
          {rsSubTab==="companies"&&(
            <div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                <button className="btn bo bs" style={{fontSize:10}} onClick={()=>{const ns={id:`rc_${Date.now()}`,name:"Nueva empresa",ticker:"",sector:"Custom",location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true};saveRoadshow({...roadshow,companies:[...roadshow.companies,ns]});}}>+ Agregar empresa</button>
                <button className="btn bg bs" style={{fontSize:10,gap:4}} onClick={()=>{
                  const dbCos=(globalDB.companies||[]);
                  if(!dbCos.length){alert("La Librería no tiene empresas. Agregá empresas en la tab 📚 Librería primero.");return;}
                  // Import all from library, skip duplicates by name
                  // Map library contact to roadshow contact format
                  const mapContact=ct=>({
                    id:ct.id||`rep_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                    name:ct.name||"",title:ct.title||ct.role||"",
                    email:ct.email||"",phone:ct.phone||""
                  });
                  let added=0,updated=0;
                  const updatedCos=roadshow.companies.map(rc=>{
                    // Find matching library company by name (case-insensitive)
                    const lib=dbCos.find(c=>c.name.toLowerCase()===rc.name.toLowerCase());
                    if(!lib) return rc;
                    // Update hqAddress and contacts from library (only if library has data)
                    const newHq=lib.hqAddress||rc.hqAddress||"";
                    const newContacts=(lib.contacts||[]).length?(lib.contacts||[]).map(mapContact):(rc.contacts||[]);
                    if(newHq!==rc.hqAddress||(lib.contacts||[]).length>0) updated++;
                    return{...rc,hqAddress:newHq,contacts:newContacts,
                      ticker:lib.ticker||rc.ticker,sector:lib.sector||rc.sector};
                  });
                  // Add companies from library that don't exist in roadshow yet
                  const existingNames=new Set(roadshow.companies.map(c=>c.name.toLowerCase()));
                  const toAdd=dbCos.filter(c=>!existingNames.has(c.name.toLowerCase())).map(c=>{
                    added++;
                    return{id:c.id||`rc_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                      name:c.name,ticker:c.ticker||"",sector:c.sector||"Custom",
                      location:"ls_office",contacts:(c.contacts||[]).map(mapContact),
                      hqAddress:c.hqAddress||"",notes:c.notes||"",active:true};
                  });
                  if(!updated&&!toAdd.length){alert("No hay datos nuevos en la Librería para importar.");return;}
                  saveRoadshow({...roadshow,companies:[...updatedCos,...toAdd]});
                  const parts=[];
                  if(updated) parts.push(`${updated} empresa(s) actualizadas con datos de la Librería`);
                  if(added) parts.push(`${added} empresa(s) nuevas agregadas`);
                  alert("✅ "+parts.join(" · "));
                }}>📚 Importar desde Librería</button>
                <button className="btn bo bs" style={{fontSize:10}} onClick={()=>saveRoadshow({...roadshow,companies:roadshow.companies.map(c=>({...c,active:true}))})}>Activar todas</button>
                <button className="btn bo bs" style={{fontSize:10}} onClick={()=>saveRoadshow({...roadshow,companies:roadshow.companies.map(c=>({...c,active:false}))})}>Desactivar todas</button>
                <button className="btn bo bs" style={{fontSize:10,gap:4}} onClick={()=>rsExcelRef.current?.click()}>📥 Importar Excel</button>
                <div style={{marginLeft:"auto",fontSize:11,color:"var(--dim)"}}>{roadshow.companies.filter(c=>c.active).length} activas de {roadshow.companies.length}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {roadshow.companies.map((co,ci)=>{
                  function setCo(f,v){const nc=[...roadshow.companies];nc[ci]={...nc[ci],[f]:v};saveRoadshow({...roadshow,companies:nc});}

                  const clr=RS_CLR[co.sector]||"#666";
                  const hasMtg=roadshow.meetings.some(m=>m.companyId===co.id);
                  return(
                    <div key={co.id} style={{border:`1px solid ${co.active?clr+"44":"rgba(30,90,176,.07)"}`,borderRadius:8,padding:"10px 12px",background:co.active?"#fff":"rgba(0,0,0,.01)",opacity:co.active?1:.6,transition:"all .15s"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:co.active?8:0}}>
                        <div style={{width:34,height:34,borderRadius:6,background:clr,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <input style={{background:"transparent",border:"none",color:"#fff",width:34,textAlign:"center",fontFamily:"IBM Plex Mono,monospace",fontSize:9,fontWeight:700,padding:0,outline:"none"}} value={co.ticker} placeholder="TKR" onChange={e=>setCo("ticker",e.target.value.toUpperCase())}/>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <input className="inp" style={{fontSize:12,fontWeight:600,padding:"3px 6px",marginBottom:3}} value={co.name} placeholder="Nombre empresa" onChange={e=>setCo("name",e.target.value)}/>
                          <div style={{display:"flex",gap:4,alignItems:"center"}}>
                            <select className="sel" style={{fontSize:9,padding:"2px 4px",flex:1}} value={co.sector} onChange={e=>setCo("sector",e.target.value)}>
                              {Object.keys(RS_CLR).filter(s=>s!=="LS Internal").map(s=><option key={s} value={s}>{s}</option>)}
                            </select>
                            {hasMtg&&<span style={{fontSize:9,color:"var(--grn)",fontFamily:"IBM Plex Mono,monospace",flexShrink:0}}>✓ reunión</span>}
                          </div>
                        </div>
                        <button className={`btn bs ${co.active?"bg":"bo"}`} style={{fontSize:9,padding:"3px 7px",flexShrink:0}} onClick={()=>setCo("active",!co.active)}>{co.active?"Activa":"Off"}</button>
                      </div>
                      {co.active&&(
                        <>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                            <div>
                              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                                <div className="lbl" style={{margin:0}}>👤 Representantes</div>
                                <button className="btn bo bs" style={{fontSize:8,padding:"1px 6px"}} onClick={()=>{const c=[...(co.contacts||[])];c.push({id:`rep_${Date.now()}`,name:"",title:"",email:"",phone:""});setCo("contacts",c);}}>+ Add</button>
                              </div>
                              {(co.contacts||[]).map((rep,ri)=>(
                                <div key={rep.id||ri} style={{borderRadius:5,border:"1px solid rgba(30,90,176,.1)",padding:"5px 6px",marginBottom:4,background:"rgba(30,90,176,.02)"}}>
                                  <div style={{display:"flex",gap:3,marginBottom:3}}>
                                    <input className="inp" style={{flex:2,fontSize:10,padding:"2px 5px"}} value={rep.name||""} placeholder="Nombre *" onChange={e=>{const c=[...(co.contacts||[])];c[ri]={...c[ri],name:e.target.value};setCo("contacts",c);}}/>
                                    <input className="inp" style={{flex:1.5,fontSize:10,padding:"2px 5px"}} value={rep.title||""} placeholder="Cargo" onChange={e=>{const c=[...(co.contacts||[])];c[ri]={...c[ri],title:e.target.value};setCo("contacts",c);}}/>
                                    <button aria-label="Eliminar representante" style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:12,padding:"0 2px",flexShrink:0}} onClick={()=>{const c=(co.contacts||[]).filter((_,j)=>j!==ri);setCo("contacts",c);}}>✕</button>
                                  </div>
                                  <div style={{display:"flex",gap:3}}>
                                    <input className="inp" style={{flex:2,fontSize:10,padding:"2px 5px"}} value={rep.email||""} placeholder="email@empresa.com" onChange={e=>{const c=[...(co.contacts||[])];c[ri]={...c[ri],email:e.target.value};setCo("contacts",c);}}/>
                                    <input className="inp" style={{flex:1.5,fontSize:10,padding:"2px 5px"}} value={rep.phone||""} placeholder="+54 11..." onChange={e=>{const c=[...(co.contacts||[])];c[ri]={...c[ri],title:c[ri].title,phone:e.target.value};setCo("contacts",c);}}/>
                                  </div>
                                </div>
                              ))}
                              {!(co.contacts||[]).length&&<div style={{fontSize:10,color:"var(--dim)"}}>Sin representantes.</div>}
                            </div>
                            <div>
                              <div className="lbl" style={{marginBottom:2}}>Lugar de reunión</div>
                              <select className="sel" style={{fontSize:10,padding:"3px 6px",marginBottom:3}} value={co.location} onChange={e=>setCo("location",e.target.value)}>
                                <option value="ls_office">🏛 Oficinas LS</option>
                                <option value="hq">🏢 Sede empresa</option>
                                <option value="custom">📍 Otro</option>
                              </select>
                              {(co.location==="hq")&&(
                                <input className="inp" style={{fontSize:10,padding:"3px 6px",marginBottom:3}} value={co.hqAddress||""} placeholder="Dirección HQ (para Google Maps)..." onChange={e=>setCo("hqAddress",e.target.value)}/>
                              )}
                              {(co.location==="custom")&&<input className="inp" style={{fontSize:10,padding:"3px 6px",marginBottom:3}} value={co.locationCustom||""} placeholder="Otra dirección..." onChange={e=>setCo("locationCustom",e.target.value)}/>}
                              <textarea className="inp" style={{fontSize:10,padding:"3px 6px",minHeight:44,resize:"none"}} value={co.notes||""} placeholder="Notas..." onChange={e=>setCo("notes",e.target.value)}/>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:5}}>
                            <button className="btn bo bs" style={{fontSize:9,flex:1,gap:3}} onClick={()=>{const email=genRSEmail(co,roadshow.trip,roadshow.meetings,lsCont,tripDays);setRsEmailModal({company:co,emailData:email});}}>✉️ Ver email</button>
                            <button className="btn bg bs" style={{fontSize:9,gap:3,flex:1}} onClick={()=>{const firstWork=tripDays.find(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;})||tripDays[0];if(!firstWork){alert("Configurá las fechas primero.");return;}setRsMtgModal({date:firstWork,hour:9,meeting:null,preCoId:co.id});}}>+ Reunión</button>
                            <button aria-label={`Eliminar ${co.name}`} className="btn bd bs" style={{fontSize:9,padding:"3px 7px"}} onClick={()=>{if(confirm(`Eliminar ${co.name}?`))saveRoadshow({...roadshow,companies:roadshow.companies.filter((_,j)=>j!==ci)});}}> ✕</button>
                          </div>
                        </>
                      )}
                    </div>);
                })}
              </div>
            </div>
          )}

          {/* EMAILS */}
          {rsSubTab==="travel"&&(()=>{
            const workDays=tripDays.filter(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;});
            const dur=roadshow.trip.meetingDuration||60;

            return(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                <div>
                  <h3 style={{fontFamily:"Playfair Display,serif",fontSize:16,color:"var(--cream)",marginBottom:2}}>🗺️ Tiempos de traslado</h3>
                  <p style={{fontSize:12,color:"var(--dim)"}}>Verificá que haya tiempo suficiente entre reuniones considerando el traslado.</p>
                </div>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{fontSize:11,background:"rgba(58,140,92,.07)",border:"1px solid rgba(58,140,92,.2)",borderRadius:6,padding:"5px 10px",color:"var(--dim)"}}>
                    🆓 OpenStreetMap — sin API key
                  </div>
                  <button className="btn bg bs" style={{fontSize:10,gap:5}} disabled={travelLoading} onClick={calcAllTravel}>
                    {travelLoading?"⏳ Calculando...":"🔄 Calcular todos los traslados"}
                  </button>
                </div>
              </div>

              {workDays.map(date=>{
                const dayMtgs=[...(roadshow.meetings||[])].filter(m=>m.date===date&&m.status!=="cancelled").sort((a,b)=>a.hour-b.hour);
                if(!dayMtgs.length) return null;
                const d=new Date(date+"T12:00:00");
                const dayLabel=d.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
                const dayTravel=travelCache[date]||{};

                return(
                  <div key={date} className="card" style={{marginBottom:12}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:12,fontWeight:700,color:"var(--cream)",textTransform:"capitalize"}}>{dayLabel}</div>
                      <div style={{display:"flex",gap:6}}>
                        {dayMtgs.length>=2&&<button className="btn bo bs" style={{fontSize:9,gap:4}} disabled={travelLoading}
                          onClick={()=>calcDayTravel(date)}>
                          "🔄 Calcular tiempos"
                        </button>}
                        {dayMtgs.length>=2&&<button className="btn bo bs" style={{fontSize:9,gap:4}}
                          onClick={()=>{const addrs=dayMtgs.map(m=>{const co=m.type==="company"?rsCoMapForTravel.get(m.companyId):null;return getMeetingAddress(m,co,roadshow.trip.officeAddress);});openGoogleMapsRoute(addrs);}}>
                          🗺️ Abrir ruta
                        </button>}
                      </div>
                    </div>

                    {/* Timeline */}
                    <div style={{position:"relative",paddingLeft:24}}>
                      {/* Vertical line */}
                      <div style={{position:"absolute",left:9,top:8,bottom:8,width:2,background:"rgba(30,90,176,.15)",borderRadius:1}}/>

                      {dayMtgs.map((m,mi)=>{
                        const co=m.type==="company"?rsCoMapForTravel.get(m.companyId):null;
                        const clr=m.type==="company"?(RS_CLR[co?.sector]||"#666"):"#23a29e";
                        const addr=getMeetingAddress(m,co,roadshow.trip.officeAddress);
                        const endHour=m.hour+Math.floor(dur/60);
                        const travelData=mi<dayMtgs.length-1?dayTravel[`${date}-${mi}`]:null;
                        const nextM=mi<dayMtgs.length-1?dayMtgs[mi+1]:null;
                        const conflict=nextM?checkTravelConflict(m,nextM,travelData?.durationSec??null,dur):null;
                        return(
                          <div key={m.id}>
                            {/* Meeting block */}
                            <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:4}}>
                              <div style={{width:18,height:18,borderRadius:"50%",background:clr,flexShrink:0,marginTop:2,zIndex:1,boxShadow:"0 0 0 3px var(--ink)"}}/>
                              <div style={{flex:1,background:conflict?.conflict?"rgba(214,68,68,.06)":conflict?.warning?"rgba(232,133,10,.06)":"rgba(30,90,176,.03)",borderRadius:7,padding:"8px 11px",border:`1px solid ${conflict?.conflict?"rgba(214,68,68,.2)":conflict?.warning?"rgba(232,133,10,.2)":"rgba(30,90,176,.08)"}`}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                                  <div>
                                    <span style={{fontFamily:"IBM Plex Mono,monospace",fontWeight:700,fontSize:11,color:clr}}>{fmtHour(m.hour||0)}</span>
                                    <span style={{fontSize:11,color:"var(--dim)",marginLeft:4}}>({dur} min)</span>
                                    <span style={{fontWeight:700,fontSize:13,color:"var(--cream)",marginLeft:8}}>{co?co.name:(m.lsType||m.title||"Meeting")}</span>
                                    {co&&<span style={{fontFamily:"IBM Plex Mono,monospace",fontSize:9,color:"#fff",background:clr,padding:"1px 5px",borderRadius:3,marginLeft:5}}>{co.ticker}</span>}
                                  </div>
                                  <button style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:"var(--dim)",padding:"0 0 0 8px",whiteSpace:"nowrap",flexShrink:0}}
                                    aria-label="Ver en Maps"
                                    onClick={()=>{const prev=mi>0?getMeetingAddress(dayMtgs[mi-1],mi>0&&dayMtgs[mi-1].type==="company"?rmMap.get(dayMtgs[mi-1].companyId):null,roadshow.trip.officeAddress):null;if(prev)openGoogleMapsDirections(prev,addr);else window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`,"_blank");}}>
                                    🗺️
                                  </button>
                                </div>
                                <div style={{fontSize:10,color:"var(--dim)",marginTop:3,display:"flex",alignItems:"center",gap:5}}>
                                  <span>📍</span>
                                  <span style={{fontStyle:addr.includes("TBD")?"italic":"normal",color:addr.includes("TBD")?"var(--red)":"var(--dim)"}}>{addr||"Sin dirección"}</span>
                                  {!addr&&<span style={{color:"var(--red)",fontSize:9}}>⚠ Falta dirección</span>}
                                </div>
                              </div>
                            </div>

                            {/* Travel gap indicator */}
                            {nextM&&(
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,paddingLeft:2}}>
                                <div style={{width:16,display:"flex",justifyContent:"center"}}><div style={{width:1,height:20,background:conflict?.conflict?"var(--red)":conflict?.warning?"#e8850a":"rgba(30,90,176,.15)"}}/></div>
                                <div style={{flex:1,display:"flex",alignItems:"center",gap:6,fontSize:10}}>
                                  {travelData?(
                                    <>
                                      <span style={{fontFamily:"IBM Plex Mono,monospace",color:conflict?.conflict?"var(--red)":conflict?.warning?"#e8850a":"var(--grn)",fontWeight:700}}>🚗 {travelData.durationText}</span>
                                      <span style={{color:"var(--dim)"}}>· {travelData.distanceText}</span>
                                      {conflict?.conflict&&<span style={{color:"var(--red)",fontWeight:700}}>⚠ CONFLICTO — solo {conflict.gapMin} min entre reuniones</span>}
                                      {conflict?.warning&&!conflict.conflict&&<span style={{color:"#e8850a"}}>⚡ Justo — {conflict.gapMin} min de margen</span>}
                                      {!conflict&&<span style={{color:"var(--grn)"}}>✓ OK ({Math.floor((nextM.hour*60)-(m.hour*60+dur)-travelData.durationSec/60)} min de margen)</span>}
                                    </>
                                  ):(
                                    <span style={{color:"var(--dim)",fontStyle:"italic"}}>
                                      {Math.round((nextM.hour-m.hour)*60-dur)} min entre reuniones — presioná Calcular para estimar traslado
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {workDays.every(d=>!(roadshow.meetings||[]).some(m=>m.date===d&&m.status!=="cancelled"))&&(
                <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)"}}>
                  <div style={{fontSize:32,marginBottom:8}}>🗺️</div>
                  <div style={{fontSize:14,color:"var(--cream)"}}>Agregá reuniones en 📅 Agenda para ver el análisis de traslados</div>
                </div>
              )}
            </div>
            );
          })()}
          {rsSubTab==="emails"&&(
            <div>
              <div className="card" style={{marginBottom:12}}>
                <div className="card-t">✉️ Solicitudes de reunión — español</div>
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:14,lineHeight:1.6}}>Hacé clic en una empresa para ver el email personalizado con fechas, horarios libres y datos del cliente.</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {roadshow.companies.filter(c=>c.active).map(co=>{
                    const hasMtg=roadshow.meetings.some(m=>m.companyId===co.id);
                    const clr=RS_CLR[co.sector]||"#666";
                    return(
                      <button key={co.id} className="btn bo bs" style={{fontSize:11,gap:5,borderColor:`${clr}55`,background:hasMtg?`${clr}12`:"transparent"}}
                        onClick={()=>{const email=genRSEmail(co,roadshow.trip,roadshow.meetings,lsCont,tripDays);setRsEmailModal({company:co,emailData:email});}}>
                        <div style={{width:7,height:7,borderRadius:1,background:clr,flexShrink:0}}/>
                        {co.name}
                        {hasMtg&&<span style={{fontSize:9,color:"var(--grn)"}}>✓</span>}
                      </button>);
                  })}
                </div>
              </div>
              <div className="card" style={{background:"rgba(30,90,176,.02)"}}>
                <div className="card-t">💡 El email incluye automáticamente</div>
                <div style={{fontSize:12,color:"var(--txt)",lineHeight:1.9}}>
                  ✓ Los horarios disponibles (sin reunión asignada) &nbsp;·&nbsp; ✓ Nombre del cliente y fondo &nbsp;·&nbsp; ✓ Fechas y hotel &nbsp;·&nbsp; ✓ Lugar de la reunión (LS u otra) &nbsp;·&nbsp; ✓ Datos de contacto de {lsCont?.name||"el equipo LS"}
                </div>
              </div>
            </div>
          )}

          {/* EXPORT */}
          {rsSubTab==="export"&&(
            <div>
              {/* Send to investor */}
              <div className="card" style={{marginBottom:16,borderLeft:"3px solid var(--gold)",background:"rgba(30,90,176,.02)"}}>
                <div className="card-t" style={{marginBottom:6}}>📧 Enviar agenda al inversor</div>
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:10,lineHeight:1.6}}>
                  Generá el email con la agenda completa para enviar directamente a {(roadshow.trip.visitors||[]).length>0?`${roadshow.trip.visitors.map(v=>v.name.split(" ")[0]).join(" y ")} (${roadshow.trip.fund||roadshow.trip.clientName})`:"los visitantes"}.
                </p>
                <button className="btn bg bs" style={{gap:6}} onClick={()=>setRsAgendaEmailModal(true)}>
                  📧 Ver email con agenda
                </button>
              </div>
              <div className="sec-hdr" style={{marginBottom:8}}>📄 Agenda del Roadshow (English · formato LS)</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportRoadshowPDF} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")exportRoadshowPDF();}}>
                  <div className="ex-card-ico">📄</div>
                  <div className="ex-card-t">PDF — Agenda completa</div>
                  <div className="ex-card-s">Formato LS, English. Para compartir con el cliente.</div>
                </div>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportRoadshowWord} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")exportRoadshowWord();}}>
                  <div className="ex-card-ico">📝</div>
                  <div className="ex-card-t">Word — Agenda completa</div>
                  <div className="ex-card-s">Documento .doc editable, mismo formato.</div>
                </div>
              </div>
              <div className="sec-hdr" style={{marginBottom:8}}>📅 Outlook / Calendario (.ICS)</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportRoadshowICS} onKeyDown={e=>{if(e.key==="Enter")exportRoadshowICS();}}>
                  <div className="ex-card-ico">📅</div>
                  <div className="ex-card-t">Exportar .ICS (Outlook)</div>
                  <div className="ex-card-s">Todas las reuniones confirmadas como invitaciones de calendario.</div>
                </div>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportBookingPage} onKeyDown={e=>{if(e.key==="Enter")exportBookingPage();}}>
                  <div className="ex-card-ico">🔗</div>
                  <div className="ex-card-t">Página de reserva (HTML)</div>
                  <div className="ex-card-s">Las empresas eligen horario — first-come-first-served. Te mandan código de confirmación.</div>
                </div>
              </div>
              <div className="sec-hdr" style={{marginBottom:8}}>📋 Compartir disponibilidad (español)</div>
              <div className="card">
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:10,lineHeight:1.6}}>Genera un resumen de los horarios libres para enviar a las empresas por WhatsApp o email.</p>
                <button className="btn bo bs" style={{gap:5}} onClick={()=>{
                  const busy=new Set(roadshow.meetings.map(m=>`${m.date}-${m.hour}`));
                  const workDays=tripDays.filter(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;});
                  const lines=workDays.map(date=>{
                    const d=new Date(date+"T12:00:00");
                    const ds=d.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
                    const fh=[9,10,11,12,14,15,16,17].filter(h=>!busy.has(`${date}-${h}`));
                    if(!fh.length) return null;
                    return `${ds.charAt(0).toUpperCase()+ds.slice(1)}:\n${fh.map(h=>`  • ${h}:00 – ${h+1}:00 hs`).join("\n")}`;
                  }).filter(Boolean);
                  const d1=roadshow.trip.arrivalDate?new Date(roadshow.trip.arrivalDate+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"long"}):"";
                  const d2=roadshow.trip.departureDate?new Date(roadshow.trip.departureDate+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"}):"";
                  const txt=`Horarios disponibles${roadshow.trip.clientName?" — "+roadshow.trip.clientName:""}\nBuenos Aires${d1?" · "+d1+" – "+d2:""}\n\n${lines.join("\n\n")||"Sin horarios disponibles"}\n\nLugar: ${roadshow.trip.officeAddress||"Arenales 707, 6° Piso, CABA"} (o en la sede de la empresa, según preferencia).`;
                  navigator.clipboard.writeText(txt).then(()=>alert("✅ Horarios copiados al portapapeles.")).catch(()=>{const w=window.open("","_blank","width=580,height=480");w.document.write("<pre style='font:13px monospace;padding:20px;white-space:pre-wrap'>"+txt.replace(/</g,"&lt;")+"</pre>");w.document.close();});
                }}>📋 Copiar horarios disponibles</button>
              </div>
            </div>
          )}

          {/* Modals */}
          {rsMtgModal&&<RoadshowMeetingModal
            mode={rsMtgModal.meeting?"edit":"add"}
            date={rsMtgModal.date} hour={rsMtgModal.hour}
            meeting={rsMtgModal.meeting}
            companies={roadshow.companies}
            trip={roadshow.trip}
            onSave={saveMtg}
            onDelete={()=>delMtg(rsMtgModal.meeting?.id)}
            onClose={()=>setRsMtgModal(null)}
          />}
          {rsEmailModal&&<RoadshowEmailModal
            company={rsEmailModal.company}
            emailData={rsEmailModal.emailData}
            onClose={()=>setRsEmailModal(null)}
          />}
          {rsAgendaEmailModal&&<RoadshowAgendaEmailModal
            roadshow={roadshow}
            rsCos={roadshow.companies}
            tripDays={tripDays}
            lsContact={(config.contacts||[])[roadshow.trip.lsContactIdx||0]||{}}
            onClose={()=>setRsAgendaEmailModal(false)}
          />}
        </div>
        );
      })()}


      {tab==="outbound"&&(()=>{
        const RS_HOURS=ROADSHOW_HOURS;
        function addDest(){
          const nd={id:`dest-${Date.now()}`,city:"",country:"",dateFrom:"",dateTo:"",hotel:"",meetings:[]};
          saveOutbound({...outbound,destinations:[...outbound.destinations,nd]});
        }
        function upDest(id,field,val){saveOutbound({...outbound,destinations:outbound.destinations.map(d=>d.id===id?{...d,[field]:val}:d)});}
        function delDest(id){saveOutbound({...outbound,destinations:outbound.destinations.filter(d=>d.id!==id)});}
        function addMeeting(destId){
          const dest=outbound.destinations.find(d=>d.id===destId);if(!dest)return;
          const nm={id:`obm-${Date.now()}`,fund:"",contact:"",email:"",hour:9,duration:60,status:"tentative",location:"",notes:"",date:dest.dateFrom||""};
          const nd=outbound.destinations.map(d=>d.id===destId?{...d,meetings:[...d.meetings,nm]}:d);
          saveOutbound({...outbound,destinations:nd});
        }
        function upMeeting(destId,mtgId,field,val){
          const nd=outbound.destinations.map(d=>d.id===destId?{...d,meetings:d.meetings.map(m=>m.id===mtgId?{...m,[field]:val}:m)}:d);
          saveOutbound({...outbound,destinations:nd});
        }
        function delMeeting(destId,mtgId){
          const nd=outbound.destinations.map(d=>d.id===destId?{...d,meetings:d.meetings.filter(m=>m.id!==mtgId)}:d);
          saveOutbound({...outbound,destinations:nd});
        }
        const totalMtgs=outbound.destinations.reduce((s,d)=>s+d.meetings.length,0);
        const confirmed=outbound.destinations.reduce((s,d)=>s+d.meetings.filter(m=>m.status==="confirmed").length,0);
        const fmtShort=iso=>iso?new Date(iso+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):"";
        const COUNTRY_FLAGS={US:"🇺🇸","United States":"🇺🇸",Brazil:"🇧🇷",Brasil:"🇧🇷",Chile:"🇨🇱",UK:"🇬🇧","United Kingdom":"🇬🇧",Germany:"🇩🇪",Alemania:"🇩🇪",France:"🇫🇷",Francia:"🇫🇷",Spain:"🇪🇸",España:"🇪🇸",Netherlands:"🇳🇱",Italy:"🇮🇹",Switzerland:"🇨🇭",Portugal:"🇵🇹",Japan:"🇯🇵",Canada:"🇨🇦",Mexico:"🇲🇽"};
        const flag=c=>COUNTRY_FLAGS[c]||"🌎";

        function exportOutboundAgenda(){
          const lsCont=(config.contacts||[])[0]||{};
          const teamNames=(outbound.team||[]).map(t=>t.name).filter(Boolean);
          const lines=outbound.destinations.map(dest=>{
            if(!dest.meetings.length) return null;
            const sortedMtgs=[...dest.meetings].sort((a,b)=>(a.date+a.hour).localeCompare(b.date+b.hour));
            const header=`${flag(dest.country)} ${dest.city.toUpperCase()}${dest.country?", "+dest.country:""} ${fmtShort(dest.dateFrom)?("("+fmtShort(dest.dateFrom)+(dest.dateTo&&dest.dateTo!==dest.dateFrom?"–"+fmtShort(dest.dateTo):"")+")"):""}
${"─".repeat(40)}`;
            const rows=sortedMtgs.map(m=>{
              const d=m.date?new Date(m.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}):"";
              return `  ${fmtHour(m.hour||0)}${d?" · "+d:""} | ${m.fund||"[Fund]"} | ${m.contact||""} | ${m.status==="confirmed"?"✓":"⏳"} | ${m.location||""}${m.notes?" — "+m.notes:""}`;
            }).join("\n");
            return header+"\n"+rows;
          }).filter(Boolean).join("\n\n");
          const NL="\n";const txt="LATIN SECURITIES — OUTBOUND ROADSHOW"+NL+(outbound.fund?outbound.fund+NL:"")+(teamNames.length?"Team: "+teamNames.join(", ")+NL:"")+NL+(lines||"No meetings yet.")+NL+NL+"Contact: "+(lsCont.name||"[LS]")+" · "+(lsCont.email||"")+" · "+(lsCont.phone||"")
          navigator.clipboard.writeText(txt).then(()=>alert("✅ Agenda copiada al portapapeles.")).catch(()=>{const w=window.open("","_blank","width=680,height=560");w.document.write("<pre style='font:13px monospace;padding:20px;white-space:pre-wrap'>"+txt+"</pre>");w.document.close();});
        }

        function exportOutboundICS(){
          const pad=n=>String(n).padStart(2,"0");
          const esc=s=>(s||"").replace(/[\\,;]/g,"\\$&").replace(/\n/g,"\\n");
          const dur=60;
          const events=outbound.destinations.flatMap(dest=>
            dest.meetings.filter(m=>m.status!=="cancelled"&&m.date&&m.hour).map(m=>{
              const d=new Date(m.date+"T"+pad(m.hour)+":00:00");
              const de=new Date(d.getTime()+(m.duration||dur)*60000);
              const fmt=dd=>dd.getUTCFullYear()+pad(dd.getUTCMonth()+1)+pad(dd.getUTCDate())+"T"+pad(dd.getUTCHours())+pad(dd.getUTCMinutes())+"00Z";
              const teamAttendees=(outbound.team||[]).filter(t=>t.email).map(t=>`ATTENDEE;CN="${esc(t.name)}":mailto:${t.email}`).join("\r\n");
              return `BEGIN:VEVENT\r\nUID:ob-${m.id}@latinsecurities.ar\r\nDTSTAMP:${fmt(new Date())}\r\nDTSTART:${fmt(d)}\r\nDTEND:${fmt(de)}\r\nSUMMARY:${esc((m.fund||"Meeting")+" – "+dest.city)}\r\nLOCATION:${esc(m.location||(dest.city+", "+dest.country))}\r\nDESCRIPTION:${esc(m.notes||"")}\r\n${teamAttendees?teamAttendees+"\r\n":""}END:VEVENT`;
            })
          );
          const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Latin Securities//Outbound//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n${events.join("\r\n")}\r\nEND:VCALENDAR`;
          const fn=`Outbound_${(outbound.fund||currentEvent?.name||"Roadshow").replace(/[^a-zA-Z0-9]/g,"_")}.ics`;
          downloadBlob(fn,ics,"text/calendar;charset=utf-8");
        }

        return(
        <div>
          {/* Header */}
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <div>
              <h2 className="pg-h" style={{marginBottom:2}}>✈️ Roadshow Outbound</h2>
              <p className="pg-s" style={{marginBottom:0}}>Latin Securities viaja a ver fondos. Organizá la agenda por ciudad.</p>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:10,color:"var(--grn)",padding:"4px 10px",borderRadius:5,background:"rgba(58,140,92,.1)"}}>{confirmed}/{totalMtgs} ✓ confirmadas</div>
              <button className="btn bo bs" style={{fontSize:10,gap:4}} onClick={exportOutboundAgenda}>📋 Copiar agenda</button>
              <button className="btn bo bs" style={{fontSize:10,gap:4}} onClick={exportOutboundICS}>📅 ICS</button>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{display:"flex",gap:0,marginBottom:14,borderBottom:"1px solid rgba(30,90,176,.1)"}}>
            {[["schedule","📅 Itinerario"],["team","👥 Equipo LS"],["export","📄 Exportar"]].map(([id,lbl])=>(
              <button key={id} className={`ntab${obSubTab===id?" on":""}`} style={{height:38,fontSize:10}} onClick={()=>setObSubTab(id)}>{lbl}</button>
            ))}
          </div>

          {/* ITINERARY */}
          {obSubTab==="schedule"&&(
            <div>
              {/* Trip info card */}
              <div className="card" style={{marginBottom:14}}>
                <div className="card-t">🧳 Info del Roadshow</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <div><div className="lbl">Fondo / Cliente</div><input className="inp" value={outbound.fund||""} placeholder="Ej: Merrill Lynch 2026" onChange={e=>saveOutbound({...outbound,fund:e.target.value})}/></div>
                  <div><div className="lbl">Subtítulo / descripción</div><input className="inp" value={outbound.subtitle||""} placeholder="Ej: Marketing roadshow Q2" onChange={e=>saveOutbound({...outbound,subtitle:e.target.value})}/></div>
                  <div><div className="lbl">Notas generales</div><input className="inp" value={outbound.notes||""} placeholder="Logística, visa, etc." onChange={e=>saveOutbound({...outbound,notes:e.target.value})}/></div>
                </div>
              </div>

              {/* Destinations */}
              {outbound.destinations.map((dest,di)=>{
                const sortedMtgs=[...dest.meetings].sort((a,b)=>(a.date+String(a.hour)).localeCompare(b.date+String(b.hour)));
                return(
                  <div key={dest.id} className="card" style={{marginBottom:14,borderLeft:`3px solid ${["#1e5ab0","#23a29e","#e8850a","#7b35b0","#3a8c5c"][di%5]}`}}>
                    {/* Destination header */}
                    <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:12,flexWrap:"wrap"}}>
                      <div style={{fontSize:28}}>{flag(dest.country)}</div>
                      <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                        <div><div className="lbl">Ciudad</div><input className="inp" style={{fontSize:12}} value={dest.city} placeholder="New York" onChange={e=>upDest(dest.id,"city",e.target.value)}/></div>
                        <div><div className="lbl">País</div>
                          <select className="sel" style={{fontSize:12}} value={dest.country} onChange={e=>upDest(dest.id,"country",e.target.value)}>
                            <option value="">— País —</option>
                            {["United States","Brazil","Chile","United Kingdom","Germany","France","Netherlands","Spain","Switzerland","Italy","Portugal","Canada","Mexico","Japan"].map(c=><option key={c} value={c}>{flag(c)} {c}</option>)}
                          </select></div>
                        <div><div className="lbl">Llegada</div><DayDateInput day={{date:dest.dateFrom,short:dest.dateFrom,long:""}} di={di*2} onChange={nd=>upDest(dest.id,"dateFrom",nd.date)}/></div>
                        <div><div className="lbl">Salida</div><DayDateInput day={{date:dest.dateTo,short:dest.dateTo,long:""}} di={di*2+1} onChange={nd=>upDest(dest.id,"dateTo",nd.date)}/></div>
                      </div>
                      <div style={{display:"flex",gap:5,flexShrink:0}}>
                        <button className="btn bg bs" style={{fontSize:9}} onClick={()=>addMeeting(dest.id)}>+ Reunión</button>
                        <button aria-label="Eliminar destino" className="btn bd bs" style={{fontSize:9}} onClick={()=>{if(confirm(`Eliminar ${dest.city||"destino"}?`))delDest(dest.id);}}>✕</button>
                      </div>
                    </div>
                    <div style={{marginBottom:8}}><div className="lbl">Hotel</div><input className="inp" style={{fontSize:11}} value={dest.hotel||""} placeholder="Four Seasons, Hilton, etc." onChange={e=>upDest(dest.id,"hotel",e.target.value)}/></div>

                    {/* Visual time grid — 30-min slots, one col per day */}
                    {(()=>{
                      // Snap :15/:45 → nearest :00/:30 for display only
                      const snapH=h=>Math.round(h*2)/2;
                      // Collect unique days in this destination
                      const destDays=[...new Set(dest.meetings.map(m=>m.date))].sort();
                      // 30-min slot rows 8:00–20:00
                      const OB_SLOTS=Array.from({length:25},(_,i)=>8+i*0.5); // 8.0,8.5,...20.0
                      // Build slot→meeting map per day
                      const slotMap={};
                      dest.meetings.forEach(m=>{
                        const key=`${m.date}-${snapH(m.hour)}`;
                        slotMap[key]=m;
                      });
                      const clrByStatus={confirmed:"#23a29e",tentative:"#e8850a",cancelled:"#b03030"};
                      return(
                      <div>
                        {/* Grid */}
                        {destDays.length>0&&(
                        <div style={{overflowX:"auto",marginBottom:10}}>
                          <table style={{borderCollapse:"collapse",fontSize:10,tableLayout:"fixed"}}>
                            <colgroup>
                              <col style={{width:42}}/>
                              {destDays.map(d=><col key={d} style={{width:Math.max(90,Math.floor(600/destDays.length))}}/>)}
                            </colgroup>
                            <thead>
                              <tr>
                                <th style={{padding:"3px 4px",fontSize:8,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}></th>
                                {destDays.map(d=>{
                                  const dt=new Date(d+"T12:00:00");
                                  return <th key={d} style={{padding:"4px 6px",textAlign:"center",fontSize:9,fontFamily:"IBM Plex Mono,monospace",color:"var(--cream)",fontWeight:700,borderBottom:"2px solid rgba(30,90,176,.15)",background:"rgba(30,90,176,.04)"}}>
                                    <div>{dt.toLocaleDateString("es-AR",{weekday:"short"}).replace(".","")}</div>
                                    <div style={{fontSize:11,fontWeight:900}}>{dt.getDate()}</div>
                                  </th>;
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {OB_SLOTS.map(slot=>{
                                const isHour=slot%1===0;
                                return(
                                <tr key={slot} style={{height:isHour?22:18}}>
                                  <td style={{
                                    textAlign:"right",padding:"0 5px 0 0",fontSize:8,
                                    fontFamily:"IBM Plex Mono,monospace",color:isHour?"var(--dim)":"rgba(120,140,170,.35)",
                                    verticalAlign:"top",paddingTop:2,borderRight:"2px solid rgba(30,90,176,.07)",
                                    whiteSpace:"nowrap"
                                  }}>
                                    {isHour?fmtHour(slot):"·"}
                                  </td>
                                  {destDays.map(day=>{
                                    const m=slotMap[`${day}-${slot}`];
                                    const clr=m?clrByStatus[m.status]||"#666":null;
                                    return(
                                      <td key={day} style={{
                                        border:"1px solid rgba(30,90,176,.04)",
                                        background:isHour?"rgba(30,90,176,.01)":"transparent",
                                        padding:1,verticalAlign:"top",cursor:m?"pointer":"default"
                                      }}
                                        onClick={()=>{if(!m)return;const idx=dest.meetings.findIndex(x=>x.id===m.id);if(idx>=0)document.getElementById(`ob-mtg-${m.id}`)?.scrollIntoView({behavior:"smooth",block:"center"});}}
                                      >
                                        {m&&<div style={{
                                          background:`${clr}22`,border:`1px solid ${clr}55`,
                                          borderLeft:`3px solid ${clr}`,borderRadius:3,
                                          padding:"2px 4px",fontSize:8.5,lineHeight:1.3,
                                          overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",
                                          color:"var(--cream)",fontWeight:600
                                        }} title={`${fmtHour(m.hour)} ${m.fund||"?"} — ${m.location||""}`}>
                                          {fmtHour(m.hour)} {m.fund||"?"}
                                        </div>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );})}
                            </tbody>
                          </table>
                        </div>
                        )}

                        {/* Editable list below grid */}
                        {sortedMtgs.map((m,mi)=>(
                          <div key={m.id} id={`ob-mtg-${m.id}`} style={{
                            display:"grid",gridTemplateColumns:"100px 70px 1fr 1fr 1fr 100px 1fr 28px",
                            gap:4,alignItems:"center",marginBottom:4,padding:"5px 6px",
                            background:mi%2===0?"rgba(30,90,176,.02)":"transparent",
                            borderRadius:5,border:"1px solid rgba(30,90,176,.04)"
                          }}>
                            <DayDateInput day={{date:m.date,short:m.date,long:""}} di={di*100+mi} onChange={nd=>upMeeting(dest.id,m.id,"date",nd.date)}/>
                            <select className="sel" style={{fontSize:10,padding:"3px 5px"}} value={m.hour} onChange={e=>upMeeting(dest.id,m.id,"hour",parseFloat(e.target.value))}>
                              {RS_HOURS.map(h=><option key={h} value={h}>{fmtHour(h)}</option>)}
                            </select>
                            <input className="inp" style={{fontSize:10,padding:"3px 6px"}} value={m.fund||""} placeholder="Fondo / Nombre" onChange={e=>upMeeting(dest.id,m.id,"fund",e.target.value)}/>
                            <input className="inp" style={{fontSize:10,padding:"3px 6px"}} value={m.email||""} placeholder="email@fondo.com" onChange={e=>upMeeting(dest.id,m.id,"email",e.target.value)}/>
                            <input className="inp" style={{fontSize:10,padding:"3px 6px"}} value={m.location||""} placeholder={`Dirección en ${dest.city||"destino"}...`} onChange={e=>upMeeting(dest.id,m.id,"location",e.target.value)}/>
                            <select className="sel" style={{fontSize:10,padding:"3px 5px"}} value={m.status} onChange={e=>upMeeting(dest.id,m.id,"status",e.target.value)}>
                              <option value="tentative">⏳ Tentativo</option>
                              <option value="confirmed">✅ Confirmado</option>
                              <option value="cancelled">❌ Cancelado</option>
                            </select>
                            <input className="inp" style={{fontSize:10,padding:"3px 6px"}} value={m.notes||""} placeholder="Agenda, contexto..." onChange={e=>upMeeting(dest.id,m.id,"notes",e.target.value)}/>
                            <button aria-label="Eliminar" className="btn bd bs" style={{fontSize:9,padding:"2px 4px"}} onClick={()=>delMeeting(dest.id,m.id)}>✕</button>
                          </div>
                        ))}
                        {!sortedMtgs.length&&<div style={{fontSize:11,color:"var(--dim)",padding:"8px 0"}}>Sin reuniones — clic en + Reunión para agregar.</div>}
                      </div>
                      );
                    })()}
                  </div>
                );
              })}

              <button className="btn bg bs" style={{gap:6,marginTop:4}} onClick={addDest}>
                🌎 Agregar destino / ciudad
              </button>
              {!outbound.destinations.length&&(
                <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)",marginTop:14}}>
                  <div style={{fontSize:36,marginBottom:8}}>✈️</div>
                  <div style={{fontSize:14,color:"var(--cream)",marginBottom:6}}>Agregá los destinos del roadshow</div>
                  <div style={{fontSize:12}}>Cada destino tiene su ciudad, fechas y lista de fondos a visitar.</div>
                </div>
              )}
            </div>
          )}

          {/* TEAM */}
          {obSubTab==="team"&&(
            <div>
              <div className="card" style={{marginBottom:14}}>
                <div className="card-t">👥 Equipo Latin Securities que viaja</div>
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:12,lineHeight:1.6}}>Miembros del equipo LS en este roadshow. Se incluyen como attendees en el ICS.</p>
                {(outbound.team||[]).map((t,ti)=>(
                  <div key={ti} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                    <input className="inp" style={{flex:2,fontSize:11,padding:"3px 7px"}} value={t.name||""} placeholder="Nombre" onChange={e=>{const tm=[...(outbound.team||[])];tm[ti]={...tm[ti],name:e.target.value};saveOutbound({...outbound,team:tm});}}/>
                    <input className="inp" style={{flex:1.5,fontSize:11,padding:"3px 7px"}} value={t.title||""} placeholder="Cargo" onChange={e=>{const tm=[...(outbound.team||[])];tm[ti]={...tm[ti],title:e.target.value};saveOutbound({...outbound,team:tm});}}/>
                    <input className="inp" style={{flex:2,fontSize:11,padding:"3px 7px"}} value={t.email||""} placeholder="email@latinsecurities.ar" onChange={e=>{const tm=[...(outbound.team||[])];tm[ti]={...tm[ti],email:e.target.value};saveOutbound({...outbound,team:tm});}}/>
                    <button aria-label="Eliminar" className="btn bd bs" style={{fontSize:9,padding:"2px 6px",flexShrink:0}} onClick={()=>{const tm=(outbound.team||[]).filter((_,j)=>j!==ti);saveOutbound({...outbound,team:tm});}}>✕</button>
                  </div>
                ))}
                <button className="btn bo bs" style={{fontSize:10,marginTop:6}} onClick={()=>saveOutbound({...outbound,team:[...(outbound.team||[]),{name:"",title:"",email:""}]})}>+ Agregar miembro</button>
              </div>
              {/* Preset LS contacts */}
              {(config.contacts||[]).length>0&&(
                <div className="card">
                  <div className="card-t">⚡ Agregar desde contactos LS</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {(config.contacts||[]).map((c,ci)=>{
                      const already=(outbound.team||[]).some(t=>t.email===c.email||t.name===c.name);
                      return(<button key={ci} className="btn bo bs" style={{fontSize:10,opacity:already?.5:1}} onClick={()=>{if(!already)saveOutbound({...outbound,team:[...(outbound.team||[]),{name:c.name,title:c.role||"",email:c.email||""}]});}}>
                        {already?"✓ ":""}{c.name}
                      </button>);
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EXPORT */}
          {obSubTab==="export"&&(
            <div>
              <div className="sec-hdr" style={{marginBottom:8}}>📄 Agenda del Roadshow</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportOutboundAgenda} onKeyDown={e=>{if(e.key==="Enter")exportOutboundAgenda();}}>
                  <div className="ex-card-ico">📋</div>
                  <div className="ex-card-t">Copiar agenda (texto)</div>
                  <div className="ex-card-s">Agenda completa por ciudad, lista para pegar en email o WhatsApp.</div>
                </div>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportOutboundICS} onKeyDown={e=>{if(e.key==="Enter")exportOutboundICS();}}>
                  <div className="ex-card-ico">📅</div>
                  <div className="ex-card-t">Exportar .ICS (Outlook)</div>
                  <div className="ex-card-s">Todas las reuniones del equipo LS como invitaciones de calendario.</div>
                </div>
              </div>
              <div className="card" style={{marginBottom:14}}>
                <div className="card-t">🔗 Resumen del itinerario</div>
                <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:11,color:"var(--txt)",lineHeight:1.9}}>
                  {outbound.destinations.map(d=>(
                    <div key={d.id} style={{marginBottom:4}}>
                      <span style={{fontSize:14}}>{flag(d.country)}</span>
                      <strong style={{color:"var(--cream)",marginLeft:6}}>{d.city}{d.country?", "+d.country:""}</strong>
                      {(d.dateFrom||d.dateTo)&&<span style={{color:"var(--dim)",marginLeft:8}}>{fmtShort(d.dateFrom)}{d.dateTo&&d.dateTo!==d.dateFrom?"–"+fmtShort(d.dateTo):""}</span>}
                      <span style={{color:"var(--gold)",marginLeft:8}}>{d.meetings.length} reunión{d.meetings.length!==1?"es":""}</span>
                      {d.hotel&&<span style={{color:"var(--dim)",marginLeft:8}}>· {d.hotel}</span>}
                    </div>
                  ))}
                  {!outbound.destinations.length&&<span style={{color:"var(--dim)"}}>Sin destinos cargados.</span>}
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {tab==="db"&&(()=>{
        const dbCos=globalDB.companies||[];
        const dbInvs=globalDB.investors||[];


        const filteredCos=dbCos.filter(c=>!coSearch||c.name.toLowerCase().includes(coSearch.toLowerCase())||c.ticker.toLowerCase().includes(coSearch.toLowerCase())||c.sector.toLowerCase().includes(coSearch.toLowerCase()));
        const filteredInvs=dbInvs.filter(i=>!invSearch||i.name.toLowerCase().includes(invSearch.toLowerCase())||(i.fund||"").toLowerCase().includes(invSearch.toLowerCase())||(i.email||"").toLowerCase().includes(invSearch.toLowerCase()));

        function saveCo(co){const db={...globalDB,companies:globalDB.companies.map(c=>c.id===co.id?co:c)};saveGlobalDB(db);setEditCo(null);}
        function addCo(){const nc={id:`dbc_${Date.now()}`,name:"",ticker:"",sector:"Other",hqAddress:"",contacts:[]};saveGlobalDB({...globalDB,companies:[...globalDB.companies,nc]});setEditCo(nc.id);}
        function delCo(id){if(confirm("¿Eliminar esta compañía de la librería?"))saveGlobalDB({...globalDB,companies:globalDB.companies.filter(c=>c.id!==id)});}
        function saveInv(inv){const db={...globalDB,investors:globalDB.investors.map(i=>i.id===inv.id?inv:i)};saveGlobalDB(db);setEditInv(null);}
        function addInv(){const ni={id:`dbi_${Date.now()}`,name:"",fund:"",position:"",email:"",phone:"",aum:"",companies:[],linkedin:"",notes:""};saveGlobalDB({...globalDB,investors:[...globalDB.investors,ni]});setEditInv(ni.id);}
        function delInv(id){if(confirm("¿Eliminar este inversor de la librería?"))saveGlobalDB({...globalDB,investors:globalDB.investors.filter(i=>i.id!==id)});}

        const SECTORS=["Financials","Energy","Infra","Real Estate","TMT","LS","Other"];

        return(
        <div>
          <h2 className="pg-h">📚 Librería Global</h2>
          <p className="pg-s">Base de datos centralizada de compañías, representantes e inversores. Compartida entre todos los eventos.</p>

          {/* Sub-tabs */}
          <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"1px solid rgba(30,90,176,.1)"}}>
            {[["companies",`🏢 Compañías (${dbCos.length})`],["investors",`👥 Inversores (${dbInvs.length})`]].map(([id,lbl])=>(
              <button key={id} className={`ntab${dbTab===id?" on":""}`} style={{height:38,fontSize:10}} onClick={()=>setDbTab(id)}>{lbl}</button>
            ))}
          </div>

          {/* ── COMPANIES ── */}
          {dbTab==="companies"&&(
            <div>
              {/* Toolbar */}
              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                <input className="inp" style={{flex:1,minWidth:200,fontSize:12}} value={coSearch} onChange={e=>setCoSearch(e.target.value)} placeholder="🔍 Buscar por nombre, ticker o sector..."/>
                <button className="btn bg bs" style={{gap:5,fontSize:11}} onClick={addCo}>+ Agregar</button>
                <button className="btn bo bs" style={{gap:5,fontSize:11}} onClick={()=>dbCoExcelRef.current?.click()}>📥 Importar Excel</button>
                <button className="btn bo bs" style={{gap:5,fontSize:11}} onClick={()=>downloadDBTemplate("companies")}>📋 Plantilla</button>
              </div>

              {/* Format hint */}
              <div style={{background:"rgba(30,90,176,.04)",border:"1px solid rgba(30,90,176,.12)",borderRadius:7,padding:"10px 14px",marginBottom:12,fontSize:11,color:"var(--dim)",lineHeight:1.8}}>
                <strong style={{color:"var(--cream)"}}>📋 Formato Excel para importar compañías:</strong><br/>
                Columnas: <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>Name</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>Ticker</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>Sector</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>HQ Address</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>Contact 1</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>Title 1</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>Email 1</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3,opacity:.7}}>Phone 1 (opt.)</code> · Contact 2, Email 2... hasta 3 contactos por empresa.
                {" "}<button className="btn bo bs" style={{fontSize:9,padding:"2px 8px",marginLeft:6}} onClick={()=>downloadDBTemplate("companies")}>Descargar plantilla →</button>
              </div>

              {/* Company list */}
              <div style={{display:"grid",gap:8}}>
                {filteredCos.map(co=>{
                  const isEdit=editCo===co.id;
                  const working=isEdit?co:co;
                  const clr=SEC_CLR[co.sector]||"#666";
                  return(
                    <div key={co.id} style={{border:`1px solid ${isEdit?"rgba(30,90,176,.3)":"rgba(30,90,176,.1)"}`,borderRadius:9,padding:"12px 14px",background:isEdit?"rgba(30,90,176,.03)":"#fff",transition:"all .15s"}}>
                      {!isEdit?(
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:38,height:38,borderRadius:7,background:clr,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"IBM Plex Mono,monospace",fontSize:9,fontWeight:700,flexShrink:0,textAlign:"center",lineHeight:1.2}}>{co.ticker||"?"}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:7}}>
                              <span style={{fontSize:13,fontWeight:700,color:"var(--cream)"}}>{co.name||"Sin nombre"}</span>
                              <span style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:`${clr}22`,color:clr,fontFamily:"IBM Plex Mono,monospace"}}>{co.sector}</span>
                            </div>
                            <div style={{fontSize:10,color:"var(--dim)",marginTop:2,display:"flex",gap:12,flexWrap:"wrap"}}>
                              {co.hqAddress&&<span>📍 {co.hqAddress}</span>}
                              
                              <span style={{color:"var(--gold)"}}>{co.contacts?.length||0} contacto(s)</span>
                            </div>
                            {(co.contacts||[]).length>0&&(
                              <div style={{marginTop:6,display:"flex",gap:6,flexWrap:"wrap"}}>
                                {co.contacts.map(r=>(
                                  <div key={r.id} style={{fontSize:10,background:"rgba(30,90,176,.06)",borderRadius:5,padding:"2px 8px",color:"var(--txt)"}}>
                                    <strong>{r.name}</strong>{r.title?` · ${r.title}`:""}{r.email?` · ${r.email}`:""}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{display:"flex",gap:5,flexShrink:0}}>
                            <button className="btn bo bs" style={{fontSize:9,padding:"3px 9px"}} onClick={()=>setEditCo(co.id)}>✏️ Editar</button>
                            <button aria-label="Eliminar" className="btn bd bs" style={{fontSize:9,padding:"3px 7px"}} onClick={()=>delCo(co.id)}>✕</button>
                          </div>
                        </div>
                      ):(
                        <div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:10}}>
                            <div><div className="lbl" style={{marginBottom:2}}>Nombre *</div><input className="inp" style={{fontSize:11}} value={co.name} placeholder="Banco Macro" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,name:e.target.value}:c);saveGlobalDB({...globalDB,companies:nc});}}/></div>
                            <div><div className="lbl" style={{marginBottom:2}}>Ticker</div><input className="inp" style={{fontSize:11,fontFamily:"IBM Plex Mono,monospace"}} value={co.ticker} placeholder="BMA" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,ticker:e.target.value.toUpperCase()}:c);saveGlobalDB({...globalDB,companies:nc});}}/></div>
                            <div><div className="lbl" style={{marginBottom:2}}>Sector</div>
                              <select className="sel" style={{fontSize:11}} value={co.sector} onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,sector:e.target.value}:c);saveGlobalDB({...globalDB,companies:nc});}}>
                                {SECTORS.map(s=><option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                          <div style={{marginBottom:10}}><div className="lbl" style={{marginBottom:2}}>Dirección HQ</div><input className="inp" style={{fontSize:11}} value={co.hqAddress||""} placeholder="Av. Eduardo Madero 1182, CABA" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,hqAddress:e.target.value}:c);saveGlobalDB({...globalDB,companies:nc});}}/></div>
                          {/* Contacts */}
                          <div style={{marginBottom:10}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                              <div className="lbl" style={{margin:0}}>👤 Representantes</div>
                              <button className="btn bo bs" style={{fontSize:9,padding:"2px 8px"}} onClick={()=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,contacts:[...(c.contacts||[]),{id:`rep_${Date.now()}`,name:"",title:"",email:"",phone:""}]}:c);saveGlobalDB({...globalDB,companies:nc});}}>+ Add</button>
                            </div>
                            {(co.contacts||[]).map((rep,ri)=>(
                              <div key={rep.id||ri} style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 2fr 1fr auto",gap:5,marginBottom:5,alignItems:"center"}}>
                                <input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={rep.name||""} placeholder="Nombre *" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,contacts:c.contacts.map((r,j)=>j===ri?{...r,name:e.target.value}:r)}:c);saveGlobalDB({...globalDB,companies:nc});}}/>
                                <input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={rep.title||""} placeholder="Cargo" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,contacts:c.contacts.map((r,j)=>j===ri?{...r,title:e.target.value}:r)}:c);saveGlobalDB({...globalDB,companies:nc});}}/>
                                <input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={rep.email||""} placeholder="email@empresa.com" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,contacts:c.contacts.map((r,j)=>j===ri?{...r,email:e.target.value}:r)}:c);saveGlobalDB({...globalDB,companies:nc});}}/>
                                <input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={rep.phone||""} placeholder="Tel. (opcional)" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,contacts:c.contacts.map((r,j)=>j===ri?{...r,phone:e.target.value}:r)}:c);saveGlobalDB({...globalDB,companies:nc});}}/>
                                <button aria-label="Eliminar rep" style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:13,padding:"0 4px"}} onClick={()=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,contacts:c.contacts.filter((_,j)=>j!==ri)}:c);saveGlobalDB({...globalDB,companies:nc});}}>✕</button>
                              </div>
                            ))}
                            {!(co.contacts||[]).length&&<div style={{fontSize:10,color:"var(--dim)"}}>Sin representantes — clic en + Add</div>}
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <button className="btn bg bs" style={{fontSize:10}} onClick={()=>setEditCo(null)}>✓ Guardar</button>
                            <button className="btn bo bs" style={{fontSize:10}} onClick={()=>setEditCo(null)}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!filteredCos.length&&(
                  <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)"}}>
                    <div style={{fontSize:36,marginBottom:8}}>🏢</div>
                    <div style={{fontSize:14,color:"var(--cream)",marginBottom:6}}>{coSearch?"Sin resultados para tu búsqueda":"Librería de compañías vacía"}</div>
                    <div style={{fontSize:12}}>Usá + Agregar o 📥 Importar Excel para cargar compañías con sus representantes.</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── INVESTORS ── */}
          {dbTab==="investors"&&(
            <div>
              {/* Toolbar */}
              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                <input className="inp" style={{flex:1,minWidth:200,fontSize:12}} value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="🔍 Buscar por nombre, fondo o email..."/>
                <button className="btn bg bs" style={{gap:5,fontSize:11}} onClick={addInv}>+ Agregar</button>
                <button className="btn bo bs" style={{gap:5,fontSize:11}} onClick={()=>dbInvExcelRef.current?.click()}>📥 Importar Excel</button>
                <button className="btn bo bs" style={{gap:5,fontSize:11}} onClick={()=>downloadDBTemplate("investors")}>📋 Plantilla</button>
              </div>

              {/* Format hint */}
              <div style={{background:"rgba(35,162,158,.04)",border:"1px solid rgba(35,162,158,.15)",borderRadius:7,padding:"10px 14px",marginBottom:12,fontSize:11,color:"var(--dim)",lineHeight:1.8}}>
                <strong style={{color:"var(--cream)"}}>📋 Formato Excel para importar inversores:</strong><br/>
                Columnas: <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Name</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Fund</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Position</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Email</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Phone</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>AUM</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Companies</code> (separadas por ;) · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>LinkedIn</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Notes</code>
                {" "}<button className="btn bo bs" style={{fontSize:9,padding:"2px 8px",marginLeft:6}} onClick={()=>downloadDBTemplate("investors")}>Descargar plantilla →</button>
              </div>

              {/* Investor list */}
              <div style={{overflowX:"auto",borderRadius:8,border:"1px solid rgba(30,90,176,.1)",boxShadow:"0 1px 4px rgba(30,90,176,.05)"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{background:"rgba(35,162,158,.06)"}}>
                    {["Nombre","Fondo","Cargo","Email","Teléfono","AUM","Empresas de interés","",""].map(h=>(
                      <th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:9,fontFamily:"IBM Plex Mono,monospace",color:"var(--dim)",borderBottom:"1px solid rgba(35,162,158,.15)",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredInvs.map((inv,ii)=>{
                      const isEdit=editInv===inv.id;
                      return(
                        <tr key={inv.id} style={{borderBottom:"1px solid rgba(30,90,176,.04)",background:isEdit?"rgba(35,162,158,.04)":ii%2===0?"rgba(30,90,176,.01)":"transparent"}}>
                          {!isEdit?(<>
                            <td style={{padding:"7px 10px",fontWeight:700,color:"var(--cream)",whiteSpace:"nowrap"}}>{inv.name}</td>
                            <td style={{padding:"7px 10px",color:"var(--txt)"}}>{inv.fund}</td>
                            <td style={{padding:"7px 10px",color:"var(--dim)",fontSize:10}}>{inv.position}</td>
                            <td style={{padding:"7px 10px",fontFamily:"IBM Plex Mono,monospace",fontSize:10,color:"var(--txt)"}}>{inv.email}</td>
                            <td style={{padding:"7px 10px",fontSize:10,color:"var(--dim)"}}>{inv.phone}</td>
                            <td style={{padding:"7px 10px",fontSize:10,color:"var(--dim)"}}>{inv.aum}</td>
                            <td style={{padding:"7px 10px",maxWidth:200}}>
                              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                                {(inv.companies||[]).map(c=><span key={c} style={{fontSize:9,background:"rgba(30,90,176,.08)",borderRadius:3,padding:"1px 5px",color:"var(--gold)"}}>{c}</span>)}
                              </div>
                            </td>
                            <td style={{padding:"7px 10px"}}><button className="btn bo bs" style={{fontSize:9,padding:"2px 8px",whiteSpace:"nowrap"}} onClick={()=>setEditInv(inv.id)}>✏️ Editar</button></td>
                            <td style={{padding:"7px 10px"}}><button aria-label="Eliminar" className="btn bd bs" style={{fontSize:9,padding:"2px 6px"}} onClick={()=>delInv(inv.id)}>✕</button></td>
                          </>):(<>
                            <td colSpan={9} style={{padding:"10px 12px"}}>
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr",gap:6,marginBottom:7}}>
                                {[["Nombre","name",""],["Fondo","fund",""],["Cargo","position","Portfolio Manager"],["Email","email",""],["Teléfono","phone",""],["AUM","aum","$2B"]].map(([lbl,f,ph])=>(
                                  <div key={f}><div className="lbl" style={{marginBottom:2,fontSize:9}}>{lbl}</div>
                                    <input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={inv[f]||""} placeholder={ph} onChange={e=>{const ni=globalDB.investors.map(i=>i.id===inv.id?{...i,[f]:e.target.value}:i);saveGlobalDB({...globalDB,investors:ni});}}/></div>
                                ))}
                              </div>
                              <div style={{marginBottom:7}}><div className="lbl" style={{marginBottom:2,fontSize:9}}>Empresas de interés (separadas por ;)</div>
                                <input className="inp" style={{fontSize:10,padding:"3px 7px",width:"100%"}} value={(inv.companies||[]).join("; ")} placeholder="YPF; Pampa; Galicia"
                                  onChange={e=>{const cos=e.target.value.split(";").map(s=>s.trim()).filter(Boolean);const ni=globalDB.investors.map(i=>i.id===inv.id?{...i,companies:cos}:i);saveGlobalDB({...globalDB,investors:ni});}}/></div>
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:7}}>
                                <div><div className="lbl" style={{marginBottom:2,fontSize:9}}>LinkedIn</div><input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={inv.linkedin||""} placeholder="linkedin.com/in/..." onChange={e=>{const ni=globalDB.investors.map(i=>i.id===inv.id?{...i,linkedin:e.target.value}:i);saveGlobalDB({...globalDB,investors:ni});}}/></div>
                                <div><div className="lbl" style={{marginBottom:2,fontSize:9}}>Notas</div><input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={inv.notes||""} placeholder="Perfil, intereses..." onChange={e=>{const ni=globalDB.investors.map(i=>i.id===inv.id?{...i,notes:e.target.value}:i);saveGlobalDB({...globalDB,investors:ni});}}/></div>
                              </div>
                              <div style={{display:"flex",gap:6}}>
                                <button className="btn bg bs" style={{fontSize:10}} onClick={()=>setEditInv(null)}>✓ Guardar</button>
                                <button className="btn bo bs" style={{fontSize:10}} onClick={()=>setEditInv(null)}>Cancelar</button>
                              </div>
                            </td>
                          </>)}
                        </tr>
                      );
                    })}
                    {!filteredInvs.length&&(
                      <tr><td colSpan={9} style={{padding:"40px 20px",textAlign:"center",color:"var(--dim)"}}>
                        <div style={{fontSize:32,marginBottom:8}}>👥</div>
                        <div style={{fontSize:13,color:"var(--cream)",marginBottom:4}}>{invSearch?"Sin resultados":"Librería de inversores vacía"}</div>
                        <div style={{fontSize:11}}>Usá + Agregar o 📥 Importar Excel para cargar inversores.</div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{marginTop:10,fontSize:10,color:"var(--dim)",lineHeight:1.7}}>
                💡 <strong>Tip:</strong> Los inversores de la librería se usan como base de datos de referencia. Al cargar el Excel de una conferencia, los datos (email, fondo, cargo) se combinan automáticamente.
              </div>
            </div>
          )}
        </div>
        );
      })()}
      {tab==="mercado"&&(()=>{
        const ccl=parseFloat(moverCCLManual)||moverCCL;
        const PRESETS=[
  {ticker:"GGAL",name:"Grupo Financiero Galicia",sector:"Financials"},
  {ticker:"YPFD",name:"YPF",sector:"Energy"},
  {ticker:"BMA",name:"Banco Macro",sector:"Financials"},
  {ticker:"BBAR",name:"BBVA Argentina",sector:"Financials"},
  {ticker:"TXAR",name:"Ternium Argentina",sector:"Industry"},
  {ticker:"ALUA",name:"Aluar",sector:"Industry"},
  {ticker:"TECO2",name:"Telecom Argentina",sector:"TMT"},
  {ticker:"TGSU2",name:"Transportadora Gas del Sur",sector:"Energy"},
  {ticker:"PAMP",name:"Pampa Energía",sector:"Energy"},
  {ticker:"HARG",name:"Holcim Argentina",sector:"Industry"},
  {ticker:"SUPV",name:"Supervielle",sector:"Financials"},
  {ticker:"VALO",name:"Grupo Supervielle",sector:"Financials"},
  {ticker:"CEPU",name:"Central Puerto",sector:"Energy"},
  {ticker:"LOMA",name:"Loma Negra",sector:"Industry"},
  {ticker:"CRES",name:"Cresud",sector:"Agro"},
  {ticker:"MIRG",name:"Mirgor",sector:"Industry"},
  {ticker:"CVH",name:"Cablevision Holding",sector:"TMT"},
  {ticker:"COME",name:"Sociedad Comercial del Plata",sector:"Conglomerate"},
  {ticker:"EDN",name:"Edenor",sector:"Energy"},
  {ticker:"TRAN",name:"Transener",sector:"Energy"}
];
        const SECTORS=["Financials","Energy","Industry","TMT","Agro","Conglomerate","Other"];
        const SECTOR_CLR={"Financials":"#1e5ab0","Energy":"#e8850a","Industry":"#3a6b3a","TMT":"#7b35b0","Agro":"#3a8c5c","Conglomerate":"#b03535","Other":"#555"};

        function calcRow(s){
          const prev=parseFloat(s.prev);const today=parseFloat(s.today);
          if(!prev||!today) return{...s,varPct:null,varUSD:null};
          const varPct=(today/prev-1)*100;
          const varUSD=ccl?(today/ccl/(prev/ccl)-1)*100:null;
          return{...s,varPct,varUSD};
        }
        const rows=moverStocks.map(calcRow);
        const sorted=[...rows].sort((a,b)=>(b.varPct??-999)-(a.varPct??-999));
        const gainers=sorted.filter(r=>r.varPct!=null&&r.varPct>0).slice(0,5);
        const losers=[...sorted].reverse().filter(r=>r.varPct!=null&&r.varPct<0).slice(0,5);

        function addStock(preset){
          if(moverStocks.find(s=>s.ticker===preset.ticker)) return;
          const ns={id:Date.now(),ticker:preset.ticker,name:preset.name,sector:preset.sector||"Other",prev:"",today:"",comment:""};
          saveMoverStocks([...moverStocks,ns]);
        }
        function updateStock(id,field,val){
          saveMoverStocks(moverStocks.map(s=>s.id===id?{...s,[field]:val}:s));
        }
        function removeStock(id){saveMoverStocks(moverStocks.filter(s=>s.id!==id));}
        function addCustom(){
          const ns={id:Date.now(),ticker:"",name:"",sector:"Other",prev:"",today:"",comment:""};
          saveMoverStocks([...moverStocks,ns]);
        }

        const pctColor=(v)=>v==null?"var(--dim)":v>0?"var(--grn)":v<0?"var(--red)":"var(--dim)";
        const pctFmt=(v,sign=true)=>v==null?"—":(sign&&v>0?"+":"")+v.toFixed(2)+"%";

        return(
        <div>
          <h2 className="pg-h">📈 Top Movers del Mercado</h2>
          <p className="pg-s">Registrá variaciones de acciones argentinas y calculá retornos en USD usando el CCL.</p>

          {/* CCL card */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-t">💵 Dólar CCL (Contado con Liquidación)</div>
            <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
              <div style={{display:"flex",gap:8,alignItems:"center",flex:1,minWidth:220}}>
                <button className="btn bg bs" style={{whiteSpace:"nowrap",gap:6}} onClick={fetchCCL} disabled={moverCCLLoading}>
                  {moverCCLLoading?"⏳ Buscando...":"🔄 Obtener automático"}
                </button>
                {moverCCL&&!moverCCLManual&&(
                  <div style={{background:"rgba(58,140,92,.12)",border:"1px solid var(--grn)",borderRadius:7,padding:"6px 14px",fontFamily:"IBM Plex Mono,monospace",fontSize:13,color:"var(--grn)",fontWeight:700}}>
                    ${moverCCL.toLocaleString("es-AR",{minimumFractionDigits:2})} ARS
                    <span style={{fontSize:9,color:"var(--dim)",display:"block",fontWeight:400}}>dolarapi.com</span>
                  </div>
                )}
                {moverCCLErr&&<div style={{fontSize:11,color:"var(--red)",maxWidth:260}}>{moverCCLErr}</div>}
              </div>
              <div style={{flex:1,minWidth:200}}>
                <div className="lbl" style={{marginBottom:3}}>O ingresá manualmente:</div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{color:"var(--dim)",fontSize:13}}>$</span>
                  <input className="inp" style={{fontSize:13,fontFamily:"IBM Plex Mono,monospace",width:130}}
                    type="number" placeholder="ej. 1187.50" value={moverCCLManual}
                    onChange={e=>{setMoverCCLManual(e.target.value);}}/>
                  <span style={{fontSize:11,color:"var(--dim)"}}>ARS/USD</span>
                  {moverCCLManual&&<div style={{fontSize:10,color:"var(--gold)",background:"rgba(30,90,176,.1)",borderRadius:4,padding:"2px 7px",fontFamily:"IBM Plex Mono,monospace"}}>manual</div>}
                </div>
              </div>
              {ccl&&<div style={{background:"var(--ink3)",borderRadius:7,padding:"8px 14px",fontFamily:"IBM Plex Mono,monospace",fontSize:11,color:"var(--txt)"}}>
                <div style={{fontSize:10,color:"var(--dim)",marginBottom:2}}>USD activo</div>
                <div style={{fontSize:15,fontWeight:700,color:"var(--cream)"}}>$ {ccl.toLocaleString("es-AR",{minimumFractionDigits:2})}</div>
              </div>}
            </div>
          </div>

          {/* Top Movers summary cards */}
          {(gainers.length>0||losers.length>0)&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <div className="card" style={{borderTop:"3px solid var(--grn)",padding:"14px 16px"}}>
              <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:10,letterSpacing:".1em",color:"var(--grn)",marginBottom:10,textTransform:"uppercase"}}>🟢 Top Gainers</div>
              {gainers.map(r=>(
                <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid rgba(30,90,176,.06)"}}>
                  <div>
                    <span style={{fontFamily:"IBM Plex Mono,monospace",fontSize:12,fontWeight:700,color:"var(--cream)"}}>{r.ticker}</span>
                    <span style={{fontSize:10,color:"var(--dim)",marginLeft:6}}>{r.name}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:13,fontWeight:700,color:"var(--grn)"}}>+{r.varPct.toFixed(2)}%</div>
                    {r.varUSD!=null&&<div style={{fontSize:9,color:"var(--dim)"}}>USD {r.varUSD>=0?"+":""}{r.varUSD.toFixed(2)}%</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="card" style={{borderTop:"3px solid var(--red)",padding:"14px 16px"}}>
              <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:10,letterSpacing:".1em",color:"var(--red)",marginBottom:10,textTransform:"uppercase"}}>🔴 Top Losers</div>
              {losers.map(r=>(
                <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid rgba(30,90,176,.06)"}}>
                  <div>
                    <span style={{fontFamily:"IBM Plex Mono,monospace",fontSize:12,fontWeight:700,color:"var(--cream)"}}>{r.ticker}</span>
                    <span style={{fontSize:10,color:"var(--dim)",marginLeft:6}}>{r.name}</span>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:13,fontWeight:700,color:"var(--red)"}}>{r.varPct.toFixed(2)}%</div>
                    {r.varUSD!=null&&<div style={{fontSize:9,color:"var(--dim)"}}>USD {r.varUSD>=0?"+":""}{r.varUSD.toFixed(2)}%</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Preset quick-add */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-t">⚡ Agregar del panel Merval</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {PRESETS.map(p=>{
                const already=moverStocks.find(s=>s.ticker===p.ticker);
                return(
                  <button key={p.ticker} className="btn bo bs"
                    style={{fontSize:10,padding:"4px 10px",opacity:already?.1:1,background:already?"rgba(30,90,176,.1)":"transparent",fontFamily:"IBM Plex Mono,monospace"}}
                    onClick={()=>addStock(p)}>
                    {already?"✓ ":""}{p.ticker}
                  </button>
                );
              })}
              <button className="btn bg bs" style={{fontSize:10,padding:"4px 10px",marginLeft:4}} onClick={addCustom}>+ Custom</button>
            </div>
          </div>

          {/* Stocks table */}
          {moverStocks.length>0&&(
          <div className="card" style={{marginBottom:14,padding:0,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(30,90,176,.08)"}}>
              <div className="card-t" style={{margin:0}}>📋 Acciones cargadas</div>
            </div>
            <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead>
                <tr style={{background:"rgba(30,90,176,.05)"}}>
                  {["Ticker","Nombre","Sector","Cierre prev. (ARS)","Cierre hoy (ARS)","Var ARS %","Precio USD","Var USD %","Comentario",""].map(h=>(
                    <th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:9,fontFamily:"IBM Plex Mono,monospace",letterSpacing:".07em",color:"var(--dim)",borderBottom:"1px solid rgba(30,90,176,.1)",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s,i)=>(
                  <tr key={s.id} style={{borderBottom:"1px solid rgba(30,90,176,.05)",background:i%2===0?"rgba(30,90,176,.015)":"transparent"}}>
                    <td style={{padding:"6px 10px",fontFamily:"IBM Plex Mono,monospace",fontWeight:700,fontSize:12,color:"var(--cream)"}}>
                      <input className="inp" style={{width:65,fontFamily:"IBM Plex Mono,monospace",fontWeight:700,fontSize:12,padding:"3px 6px",textTransform:"uppercase"}}
                        value={s.ticker} placeholder="GGAL" onChange={e=>updateStock(s.id,"ticker",e.target.value.toUpperCase())}/>
                    </td>
                    <td style={{padding:"6px 10px"}}>
                      <input className="inp" style={{width:150,fontSize:11,padding:"3px 6px"}} value={s.name} placeholder="Nombre" onChange={e=>updateStock(s.id,"name",e.target.value)}/>
                    </td>
                    <td style={{padding:"6px 10px"}}>
                      <select className="sel" style={{width:110,fontSize:11,padding:"3px 6px"}} value={s.sector||"Other"} onChange={e=>updateStock(s.id,"sector",e.target.value)}>
                        {SECTORS.map(sec=><option key={sec} value={sec}>{sec}</option>)}
                      </select>
                    </td>
                    <td style={{padding:"6px 10px"}}>
                      <input className="inp" style={{width:100,fontFamily:"IBM Plex Mono,monospace",fontSize:12,padding:"3px 6px",textAlign:"right"}} type="number"
                        value={s.prev} placeholder="0.00" onChange={e=>updateStock(s.id,"prev",e.target.value)}/>
                    </td>
                    <td style={{padding:"6px 10px"}}>
                      <input className="inp" style={{width:100,fontFamily:"IBM Plex Mono,monospace",fontSize:12,padding:"3px 6px",textAlign:"right"}} type="number"
                        value={s.today} placeholder="0.00" onChange={e=>updateStock(s.id,"today",e.target.value)}/>
                    </td>
                    <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"IBM Plex Mono,monospace",fontSize:13,fontWeight:700,color:pctColor(s.varPct)}}>
                      {pctFmt(s.varPct)}
                    </td>
                    <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"IBM Plex Mono,monospace",fontSize:12,color:"var(--dim)"}}>
                      {s.today&&ccl?("$"+(parseFloat(s.today)/ccl).toFixed(2)):"—"}
                    </td>
                    <td style={{padding:"6px 10px",textAlign:"right",fontFamily:"IBM Plex Mono,monospace",fontSize:13,fontWeight:700,color:pctColor(s.varUSD)}}>
                      {pctFmt(s.varUSD)}
                    </td>
                    <td style={{padding:"6px 10px",minWidth:180}}>
                      <input className="inp" style={{width:"100%",fontSize:11,padding:"3px 6px"}} value={s.comment||""} placeholder="Comentario breve..."
                        onChange={e=>updateStock(s.id,"comment",e.target.value)}/>
                    </td>
                    <td style={{padding:"6px 10px"}}>
                      <button className="btn bd bs" style={{padding:"3px 8px",fontSize:10}} onClick={()=>removeStock(s.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          )}

          {moverStocks.length===0&&(
            <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)"}}>
              <div style={{fontSize:36,marginBottom:10}}>📈</div>
              <div style={{fontSize:14,color:"var(--cream)",marginBottom:6}}>Agregá acciones del panel Merval o con + Custom</div>
              <div style={{fontSize:12}}>Ingresá precio de ayer y de hoy para calcular variaciones ARS y USD CCL.</div>
            </div>
          )}

          {/* Export prompt */}
          {moverStocks.length>0&&(
          <div className="card">
            <div className="card-t">🤖 Generar texto para el Daily Summary</div>
            <p style={{fontSize:12,color:"var(--dim)",marginBottom:10,lineHeight:1.6}}>
              Generá un prompt para Claude con toda la data de Top Movers para incluirlo en el Daily Summary institucional.
            </p>
            <button className="btn bg bs" style={{gap:6}} onClick={exportMoverPrompt}>
              📋 Copiar prompt para Claude
            </button>
          </div>
          )}
        </div>
        );
      })()}

    </main>
  </div>
  );
}
