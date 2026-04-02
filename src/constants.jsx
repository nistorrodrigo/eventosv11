// ── constants.js — static constants and pure utility functions ──
// No React or external library imports needed


/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS — static
═══════════════════════════════════════════════════════════════════ */
export const ALL_HOURS = [8,9,10,11,12,13,14,15,16,17,18];
export const DEFAULT_DAYS = [
  {id:"apr14", short:"Tue Apr 14",   long:"Tuesday, April 14th 2026"},
  {id:"apr15", short:"Wed Apr 15",   long:"Wednesday, April 15th 2026"},
];
// Derived helpers — populated from config at runtime, but also available statically
export const DAYS_STATIC = ["apr14","apr15"];
export const DAY_LONG_S = { apr14:"Tuesday, April 14th 2026",   apr15:"Wednesday, April 15th 2026" };
export const DAY_SHORT_S = { apr14:"Tue Apr 14",                 apr15:"Wed Apr 15" };
// Runtime versions (replaced per-event below via getDays helper)
export function getDays(cfg){ return cfg?.days?.length ? cfg.days : DEFAULT_DAYS; }
export function getDayIds(cfg){ return getDays(cfg).map(d=>d.id); }
export function getDayLong(cfg){ const m={}; getDays(cfg).forEach(d=>m[d.id]=d.long); return m; }
export function getDayShort(cfg){ const m={}; getDays(cfg).forEach(d=>m[d.id]=d.short); return m; }
export const slotDay = id => id.split("-")[0];
export const slotHour = id => parseInt(id.split("-")[1]);
export const hourLabel = h  => h===12?"12:00 PM":h>12?`${h-12}:00 PM`:`${h}:00 AM`;
export const slotLabel = id => hourLabel(slotHour(id));
export const makeRooms = n  => Array.from({length:n},(_,i)=>`Room ${i+1}`);
export const getRooms = cfg => { const n=(cfg||DEFAULT_CONFIG).numRooms; const names=(cfg||DEFAULT_CONFIG).roomNames||{}; return Array.from({length:n},(_,i)=>names[i]||`Room ${i+1}`); };
export const makeSlots = (hrs,cfg)=> getDayIds(cfg).flatMap(d=>hrs.map(h=>`${d}-${h}`));

export const DEFAULT_CONFIG = {
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

export function parseAvail(raw, hours, cfg){
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
export const COMPANIES_INIT = [
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
export const CO_MAP = {
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
export const resolveCo = raw => CO_MAP[raw.trim().toLowerCase()]||null;
export const SEC_CLR = {Financials:"#3399ff",Energy:"#ff8269",Infra:"#acd484","Real Estate":"#23a29e",TMT:"#ebaca2",LS:"#c9a227"};

export function capitalizeName(str){
  if(!str) return "";
  return str.trim().split(/\s+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ");
}


/* ═══════════════════════════════════════════════════════════════════
   FUZZY FUND MATCHING
   Strips noise words (Inc, LLC, Capital, etc.) and compares.
   Returns canonical name (the longer/first seen) if similar enough.
═══════════════════════════════════════════════════════════════════ */
export const FUND_NOISE = /\b(inc\.?|llc\.?|ltd\.?|l\.p\.?|lp|corp\.?|co\.?|capital|asset|management|mgmt|advisors?|advisory|partners?|group|fund|funds|investments?|associates?|am|global|international|intl)\.?\b/gi;

export function normalizeFund(name){
  return (name||"").toLowerCase().replace(FUND_NOISE,"").replace(/[^a-z0-9]+/g," ").trim();
}

export function buildFundAliasMap(investors){
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
export const TITLE_MAP = [
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

export function normalizePosition(raw){
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

export function normalizeFundName(raw){
  if(!raw) return "";
  // Capitalize each significant word, preserve known acronyms
  return raw.trim().split(/\s+/).map((w,i) => {
    // Keep all-caps acronyms (LP, LLC, AM, etc.) as-is if short
    if(w.length <= 4 && w === w.toUpperCase() && /^[A-Z]+\.?$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(" ");
}


export function normalizeAUM(raw){
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
export function effectiveSlots(inv, allSlots){
  return (allSlots||[]).filter(s=>(inv.slots||[]).includes(s)&&!(inv.blockedSlots||[]).includes(s));
}

export function buildRoomMap(investors, numRooms, rooms){
  const demand={};COMPANIES_INIT.forEach(c=>{demand[c.id]=0;});
  investors.forEach(inv=>(inv.companies||[]).forEach(cid=>{demand[cid]=(demand[cid]||0)+1;}));
  const sorted=[...COMPANIES_INIT].sort((a,b)=>demand[b.id]-demand[a.id]);
  const map={};sorted.slice(0,numRooms).forEach((c,i)=>{map[c.id]=rooms[i];});
  return map;
}

export function runSchedule(investors, fundGrouping, cfg){
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

