import { useState, useCallback, useMemo, useRef } from "react";
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
  eventTitle   : "Argentina in New York 2026",
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
  {id:"BMA",   name:"Banco Macro",          ticker:"BMA",   sector:"Financials"},
  {id:"BBAR",  name:"BBVA Argentina",        ticker:"BBAR",  sector:"Financials"},
  {id:"GGAL",  name:"Grupo Fin. Galicia",    ticker:"GGAL",  sector:"Financials"},
  {id:"SUPV",  name:"Grupo Supervielle",     ticker:"SUPV",  sector:"Financials"},
  {id:"BYMA",  name:"BYMA",                  ticker:"BYMA",  sector:"Financials"},
  {id:"A3",    name:"A3 Mercados",           ticker:"A3",    sector:"Financials"},
  {id:"PAM",   name:"Pampa Energía",         ticker:"PAM",   sector:"Energy"},
  {id:"YPF",   name:"YPF",                   ticker:"YPF",   sector:"Energy"},
  {id:"YPFL",  name:"YPF Luz",               ticker:"YPFL",  sector:"Energy"},
  {id:"VIST",  name:"Vista Energy",          ticker:"VIST",  sector:"Energy"},
  {id:"CEPU",  name:"Central Puerto",        ticker:"CEPU",  sector:"Energy"},
  {id:"TGS",   name:"TGS",                   ticker:"TGS",   sector:"Energy"},
  {id:"GNNEIA",name:"Genneia",               ticker:"GNNEIA",sector:"Energy"},
  {id:"MSU",   name:"MSU Energy",            ticker:"MSU",   sector:"Energy"},
  {id:"CAAP",  name:"Corporación América",   ticker:"CAAP",  sector:"Infra"},
  {id:"IRS",   name:"IRSA / Cresud",         ticker:"IRS",   sector:"Real Estate"},
  {id:"LOMA",  name:"Loma Negra",            ticker:"LOMA",  sector:"Infra"},
  {id:"TEO",   name:"Telecom Argentina",     ticker:"TEO",   sector:"TMT"},
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
  "transportadora de gas del sur (tgs)":"TGS","transportadora de gas del sur":"TGS","tgs":"TGS",
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
  const fundMap  = {};
  investors.forEach(inv=>{if(inv.fund){if(!fundMap[inv.fund])fundMap[inv.fund]=[];fundMap[inv.fund].push(inv.id);}});
  const processed=new Set(); const reqs=[];
  investors.forEach(inv=>{
    (inv.companies||[]).forEach(coId=>{
      const key=`${inv.id}::${coId}`; if(processed.has(key)) return; processed.add(key);
      const fundmates=(fundMap[inv.fund]||[]).filter(id=>id!==inv.id&&investors.find(i=>i.id===id)?.companies?.includes(coId));
      const grouped=inv.fund&&fundmates.length>0&&(fundGrouping[inv.fund]!==false);
      if(grouped){fundmates.forEach(id=>processed.add(`${id}::${coId}`));reqs.push({invIds:[inv.id,...fundmates],coId});}
      else reqs.push({invIds:[inv.id],coId});
    });
  });
  reqs.sort((a,b)=>{
    const sa=a.invIds.reduce((s,id)=>{const inv=investors.find(i=>i.id===id);return s.filter(sl=>effectiveSlots(inv,allSlots).includes(sl));},allSlots);
    const sb=b.invIds.reduce((s,id)=>{const inv=investors.find(i=>i.id===id);return s.filter(sl=>effectiveSlots(inv,allSlots).includes(sl));},allSlots);
    return sa.length-sb.length;
  });
  const invBusy={};investors.forEach(i=>{invBusy[i.id]=new Set();});
  const coBusy={};COMPANIES_INIT.forEach(c=>{coBusy[c.id]=new Set();});
  Object.entries(coBlocks).forEach(([coId,blocked])=>{if(!coBusy[coId])coBusy[coId]=new Set();(blocked||[]).forEach(s=>coBusy[coId].add(s));});
  const roomBusy={};const coLastRoom={};const meetings=[];const unscheduled=[];
  for(const req of reqs){
    let shared=allSlots;
    for(const id of req.invIds){const inv=investors.find(i=>i.id===id);shared=shared.filter(s=>effectiveSlots(inv,allSlots).includes(s)&&!invBusy[id].has(s));}
    shared=shared.filter(s=>!coBusy[req.coId].has(s));
    let placed=false;
    for(const slotId of shared){
      const preferred=fixedRoom[req.coId]||coLastRoom[req.coId];
      let room=null;
      if(preferred&&!roomBusy[`${preferred}::${slotId}`]) room=preferred;
      else room=rooms.find(r=>!roomBusy[`${r}::${slotId}`])||null;
      if(room){
        const id=`m-${Date.now()}-${Math.random().toString(36).slice(2,5)}`;
        meetings.push({id,invIds:req.invIds,coId:req.coId,slotId,room});
        req.invIds.forEach(invId=>invBusy[invId].add(slotId));
        coBusy[req.coId].add(slotId);roomBusy[`${room}::${slotId}`]=true;coLastRoom[req.coId]=room;placed=true;break;
      }
    }
    if(!placed) unscheduled.push(req);
  }
  return{meetings,unscheduled,fixedRoom};
}

/* ═══════════════════════════════════════════════════════════════════
   PERSISTENCE — localStorage (works in real browser / Vercel)
═══════════════════════════════════════════════════════════════════ */
const LS_KEY = "arginny_events_v1";
function loadEvents(){try{return JSON.parse(localStorage.getItem(LS_KEY)||"[]");}catch{return[];}}
function saveEvents(events){try{localStorage.setItem(LS_KEY,JSON.stringify(events));}catch{}}

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
<div class="ls-hdr"><div class="ls-logo"><img src="data:image/png;base64,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" style="height:40px;display:block;" alt="Latin Securities"/></div>
<div class="ev"><div class="ev-t">${esc(meta.eventTitle||'Argentina in New York 2026')}</div><div class="ev-s">${esc(meta.eventType||'LS Conference')} &middot; ${esc(meta.eventDates||'April 14–15, 2026')}</div>${meta.venue?`<div class="ev-s" style="margin-top:2px;font-style:italic">${esc(meta.venue)}</div>`:''}</div></div>
<h1>${esc(name)}</h1><h2>${esc(sub)}</h2>
${sections.map((sec,_si)=>`${_si>0?'<p style="page-break-before:always;margin:0;font-size:1pt">&nbsp;</p>':''}<table>
<tr><td colspan="${sec.headerCols.length}" class="dh">${esc(sec.dayLabel)}</td></tr>
<tr>${sec.headerCols.map(h=>`<th class="th">${esc(h)}</th>`).join("")}</tr>
${sec.rows.map((r,i)=>`<tr class="${i%2===0?"even":""}"><td class="tt">${esc(r.time)||""}</td>
<td>${r.col1html?('<div style="line-height:1.8">'+r.col1+'</div>'):('<strong>'+esc(r.col1)+'</strong>')}${r.col1b?('<br/><small style="color:#666">'+esc(r.col1b)+'</small>'):""}${r.col1c?('<br/>'+(r.col1chtml?r.col1c:('<em style="color:#555">'+esc(r.col1c)+'</em>'))):""}</td>
<td>${r.col2html?r.col2:esc(r.col2)}</td>${r.col4!==undefined?'<td>'+esc(r.col3||'')+'</td>':''}<td class="tr">${r.col4!==undefined?esc(r.col4):esc(r.col3)}</td></tr>`).join("")}
</table>`).join("")}
${(meta.contacts||[]).length?('<div style="margin-top:24px;padding-top:10px;border-top:2px solid #3399ff;font-size:9pt;color:#444"><strong style="color:#1e5ab0">Latin Securities \u2014 Event Contact</strong><br/>'+(meta.contacts||[]).map(c=>'<span>'+esc(c.name)+(c.role?' \u00b7 '+esc(c.role):'')+(c.email?' \u00b7 <a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>':'')+(c.phone?' \u00b7 '+esc(c.phone):'')+' </span>').join('&nbsp;|&nbsp;')+'</div>'):''}
</body></html>`;
}

function buildPrintHTML(entities,meta={}){
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Argentina in New York 2026</title>
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
<div class="ls-hdr"><img src="data:image/png;base64,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" style="height:40px;display:block;" alt="Latin Securities"/>
<div class="ev-info"><strong style="font-size:13pt;color:#1e5ab0">${esc(meta.eventTitle||'Argentina in New York 2026')}</strong><br><span style="font-size:9pt;color:#666">${esc(meta.eventType||'LS Conference')} &middot; ${esc(meta.eventDates||'April 14\u201315, 2026')}</span>${meta.venue?('<br><span style="font-size:9pt;color:#666;font-style:italic">'+esc(meta.venue)+'</span>'):''}</div></div>
<h1>${esc(e.name)}</h1><h2>${esc(e.sub)}</h2>
<table>
<tr><td colspan="${sec.headerCols.length}" class="dh">${esc(sec.dayLabel)}</td></tr>
<tr class="th">${sec.headerCols.map(h=>`<th>${esc(h)}</th>`).join("")}</tr>
${sec.rows.map((r,i)=>`<tr class="${i%2===0?"even":""}"><td class="tt">${esc(r.time)||""}</td>
<td>${r.col1html?('<div style="line-height:1.9;font-size:10.5pt">'+r.col1+'</div>'):('<strong>'+esc(r.col1)+'</strong>')}${r.col1b?('<br/><small>'+esc(r.col1b)+'</small>'):""}${r.col1c?('<br/>'+(r.col1chtml?r.col1c:('<em>'+esc(r.col1c)+'</em>'))):""}</td>
<td>${esc(r.col2)}</td>${r.col4!==undefined?'<td>'+esc(r.col3||'')+'</td>':''}<td class="tr">${r.col4!==undefined?esc(r.col4):esc(r.col3)}</td></tr>`).join("")}
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
        ...(dg[day]||[]).map(m=>{const invs=(m.invIds||[]).map(id=>investors.find(i=>i.id===id)).filter(Boolean);
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
function investorToEntity(inv,meetings,companies,cfg){
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
        ...(dg[d]||[]).map(m=>{const co=companies.find(c=>c.id===m.coId);
          const mInvIds=m.invIds||[];
          const mFunds2=new Set(mInvIds.map(id=>{const inv=investors.find(i=>i.id===id);return inv?.fund||id;}).filter(Boolean));const meetingType=mFunds2.size<=1?'1x1 Meeting':'Group Meeting';
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
function InvestorModal({inv,investors,meetings,companies,fundGrouping,allSlots,onUpdateInv,onToggleFundGroup,onExport,onClose}){
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
              {getDayIds(config).map(d=>(
                <div key={d} style={{marginBottom:14}}>
                  <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:10,color:getDayIds(config).indexOf(d)%2===0?"var(--blu)":"var(--grn)",marginBottom:6,letterSpacing:".06em",textTransform:"uppercase"}}>◆ {getDayShort(config)[d]||d}</div>
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
            invMeetings.length===0?<div className="alert ai">Sin reuniones asignadas.</div>
            :<table className="tbl"><thead><tr><th>Día</th><th>Hora</th><th>Compañía</th><th>Sala</th></tr></thead>
              <tbody>{invMeetings.map(m=>{const co=companies.find(c=>c.id===m.coId);return(<tr key={m.id}>
                <td><span className={`bdg ${getDayIds(config||DEFAULT_CONFIG).indexOf(slotDay(m.slotId))%2===0?"bg-b":"bg-grn"}`}>{getDayShort(config||DEFAULT_CONFIG)[slotDay(m.slotId)]||slotDay(m.slotId)}</span></td>
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
                  <button className="btn bd bs" onClick={()=>onUpdateCo({...co,attendees:(co.attendees||[]).filter((_,j)=>j!==i)})}>✕</button>
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
            coMeetings.length===0?<div className="alert ai">Sin reuniones asignadas.</div>
            :<table className="tbl"><thead><tr><th>Día</th><th>Hora</th><th>Inversor(es)</th><th>Sala</th></tr></thead>
              <tbody>{coMeetings.map(m=>{const invs=(m.invIds||[]).map(id=>investors.find(i=>i.id===id)).filter(Boolean);return(<tr key={m.id}>
                <td><span className={`bdg ${getDayIds(config||DEFAULT_CONFIG).indexOf(slotDay(m.slotId))%2===0?"bg-b":"bg-grn"}`}>{getDayShort(config||DEFAULT_CONFIG)[slotDay(m.slotId)]||slotDay(m.slotId)}</span></td>
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
  const [invIds,setInvIds]=useState(meeting?.invIds||[]);
  const [coId,setCoId]=useState(meeting?.coId||"");
  const [slotId,setSlotId]=useState(meeting?.slotId||"");
  const [room,setRoom]=useState(meeting?.room||rooms[0]);
  const hours=[...new Set(allSlots.map(s=>slotHour(s)))];
  const conflicts=useMemo(()=>{
    const c=[];if(!invIds.length||!coId||!slotId) return c;
    for(const invId of invIds){if(meetings.find(m=>m.invIds?.includes(invId)&&m.slotId===slotId&&m.id!==meeting?.id)) c.push(`${investors.find(i=>i.id===invId)?.name} ya tiene reunión`);}
    if(meetings.find(m=>m.coId===coId&&m.slotId===slotId&&m.id!==meeting?.id)) c.push(`${companies.find(c2=>c2.id===coId)?.name} ya tiene reunión`);
    if(meetings.find(m=>m.room===room&&m.slotId===slotId&&m.id!==meeting?.id)) c.push(`${room} ocupada`);
    return c;
  },[invIds,coId,slotId,room,meetings,meeting]);
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
          {conflicts.length>0&&<div className="alert aw" style={{marginTop:10}}>⚠ Conflicto: {conflicts.join(" · ")}<br/><span style={{fontSize:10,color:"var(--dim)"}}>Cambiá el horario o la sala para resolver el conflicto.</span></div>}
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
  const [events,setEvents]   = useState(()=>loadEvents());
  const [activeEv,setActiveEv] = useState(()=>{ const evs=loadEvents(); return evs.length?evs[0].id:null; });
  const [newEvName,setNewEvName] = useState("");

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
  const [prevYearData,setPrevYearData] = useState(null);
  const prevYearRef = useRef();
  const [historicalYears,setHistoricalYears] = useState([]);
  const histFileRef = useRef();
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
  function createEvent(name){
    if(events.some(e=>e.name.trim().toLowerCase()===name.trim().toLowerCase())){
      alert(`Ya existe un evento con el nombre "${name}". Usá un nombre diferente.`);
      return;
    }
    const id=`ev-${Date.now()}`;
    const ev={id,name,createdAt:new Date().toISOString(),
      investors:[],companies:COMPANIES_INIT.map(c=>({...c,attendees:[]})),
      meetings:[],unscheduled:[],fixedRoom:{},fundGrouping:{},config:DEFAULT_CONFIG};
    const next=[...events,ev]; setEvents(next); saveEvents(next); setActiveEv(id); setNewEvName(""); setTab("upload");
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
        const co = companies.find(c=>c.id===m.coId);
        const invs = (m.invIds||[]).map(id=>investors.find(i=>i.id===id)).filter(Boolean);
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
          const invs=(m.invIds||[]).map(id=>investors.find(i=>i.id===id)).filter(Boolean);
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
          const co=companies.find(c=>c.id===m.coId);
          const day=getDays().find(d=>d.id===m.day);
          const mInvsZ=(m.invIds||[]).map(id=>investors.find(i=>i.id===id)).filter(Boolean);const mFundsZ=new Set(mInvsZ.map(i=>i.fund||i.id).filter(Boolean));const mType=mFundsZ.size<=1?"1x1":"Group";
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
        return [inv.name, inv.fund||"", inv.email||"", inv.phone||"", inv.position||"", inv.aum||"", nMtgs, (inv.companies||[]).map(cid=>{const co=companies.find(c=>c.id===cid);return co?.ticker||cid;}).join(", ")];
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
    const data=investorToEntity(inv,meetings,companies,config); if(!data){alert("Sin reuniones.");return;}
    const fname=`${inv.fund||inv.name}_${inv.name}`.replace(/[^a-zA-Z0-9_\-]/g,"_").replace(/_+/g,"_");
    if(format==="word") downloadBlob(`${fname}.doc`,buildWordHTML(data.name,data.sub,data.sections,config),"application/msword");
    else openPrint(buildPrintHTML([data],config));
  }
  function exportCompany(co,format){
    const data=companyToEntity(co,meetings,investors,config); if(!data){alert("Sin reuniones.");return;}
    if(format==="word") downloadBlob(`${co.ticker}_schedule.doc`,buildWordHTML(data.name,data.sub,data.sections,config),"application/msword");
    else openPrint(buildPrintHTML([{...data,attendees:co.attendees}],config));
  }
  function exportAll(scope,format){
    if(!scheduled){alert("Generá la agenda primero.");return;}
    const entities=scope==="companies"
      ?companies.map(co=>companyToEntity(co,meetings,investors,config)).filter(Boolean)
      :investors.map(inv=>investorToEntity(inv,meetings,companies,config)).filter(Boolean);
    if(!entities.length){alert("Sin datos.");return;}
    if(format==="pdf_combined"){openPrint(buildPrintHTML(entities,config));return;}
    const files=entities.map(e=>({name:`${e.name.replace(/[^a-zA-Z0-9\s]/g,"").replace(/\s+/g,"_").slice(0,40)}${format==="word"?".doc":".html"}`,data:format==="word"?buildWordHTML(e.name,e.sub,e.sections,config):buildPrintHTML([e],config)}));
    downloadBlob(`ArgentinaInNY2026_${scope==="companies"?"Companies":"Investors"}.zip`,buildZip(files),"application/zip");
  }

  // ── Derived ──────────────────────────────────────────────────
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
      const msg = coConflict ? `${companies.find(c=>c.id===newCoId)?.name||newCoId} ya tiene reunión a ese horario`
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

  const TABS=[
    {id:"config",label:"⚙ Config"},
    {id:"upload",label:"📥 Cargar"},
    {id:"investors",label:`👥 (${investors.length})`},
    {id:"companies",label:"🏢 Compañías"},
    {id:"schedule",label:"📅 Agenda"},
    {id:"export",label:"⬇ Exportar"},
    {id:"historical",label:"📊 Histórico"},
  ];

  if(!currentEvent) return(
    <div className="app"><style>{CSS}</style>
      <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32}}>
        <div style={{fontFamily:"Playfair Display,serif",fontSize:28,color:"var(--gold)",marginBottom:8}}>Argentina in New York 2026</div>
        <div style={{color:"var(--dim)",fontSize:14,marginBottom:40}}>Latin Securities · Roadshow/Event Manager</div>
        <div className="card" style={{maxWidth:420,width:"100%"}}>
          <div className="card-t">🗓 Crear nuevo evento</div>
          <div className="lbl">Nombre del evento</div>
          <input className="inp" style={{marginBottom:12}} placeholder="Ej: Argentina in New York 2026" value={newEvName} onChange={e=>setNewEvName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&newEvName.trim()&&createEvent(newEvName.trim())}/>
          <button className="btn bg" style={{width:"100%"}} onClick={()=>newEvName.trim()&&createEvent(newEvName.trim())}>Crear evento</button>
        </div>
      </div>
    </div>
  );

  return(
    <div className="app"><style>{CSS}</style>

    {/* MODALS */}
    {invProfile&&<InvestorModal inv={invProfile} investors={investors} meetings={meetings} companies={companies}
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
        <h1>Argentina in New York 2026</h1>
        <p>Latin Securities · Roadshow/Event Manager</p>
      </div>
      {/* Event switcher */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginRight:16,padding:"0 12px",borderRight:"1px solid rgba(255,255,255,.07)"}}>
        <span style={{fontSize:10,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".06em"}}>Evento:</span>
        <select className="sel" style={{width:"auto",fontSize:11,padding:"4px 8px"}} value={activeEv||""}
          onChange={e=>{setActiveEv(e.target.value);setTab("schedule");}}>
          {events.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
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
              <div className="lbl">Nombre del nuevo evento</div>
              <div className="flex" style={{marginTop:4}}>
                <input className="inp" style={{flex:1}} placeholder="Brasil Roadshow 2026" value={newEvName} onChange={e=>setNewEvName(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&newEvName.trim()&&(createEvent(newEvName.trim()),setShowEvMgr(false))}/>
                <button className="btn bg bs" onClick={()=>{if(newEvName.trim()){createEvent(newEvName.trim());setShowEvMgr(false);}}}>Crear</button>
              </div>
            </div>
            <div className="sec-hdr">Eventos existentes</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>
              {events.map(e=>(
                <div key={e.id} className={`ev-card${e.id===activeEv?" active-ev":""}`}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13.5,color:"var(--cream)",fontFamily:"Playfair Display,serif"}}>{e.name}</div>
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

    <div className="body">

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
                <input className="inp" value={config.eventTitle||""} onChange={e=>setConfig(c=>({...c,eventTitle:e.target.value}))} placeholder="Argentina in New York 2026"/>
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
              <div style={{fontSize:13,fontWeight:700,color:"var(--cream)"}}>{config.eventTitle||"Argentina in New York 2026"}</div>
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
              <div key={d.id} style={{display:"flex",gap:8,alignItems:"flex-end",padding:"8px 0",borderBottom:"1px solid rgba(30,90,176,.07)",marginBottom:4}}>
                <div style={{width:32,height:32,borderRadius:6,background:di%2===0?"#1e5ab0":"#23a29e",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"IBM Plex Mono,monospace",fontSize:11,fontWeight:700,flexShrink:0}}>{di+1}</div>
                <div style={{flex:1}}><div className="lbl">Short Label</div>
                  <input className="inp" style={{fontSize:11.5}} value={d.short} placeholder="Mon Apr 14"
                    onChange={e=>{const nd=[...config.days];nd[di]={...nd[di],short:e.target.value};setConfig(c=>({...c,days:nd}));}}/></div>
                <div style={{flex:2}}><div className="lbl">Long Label (for export)</div>
                  <input className="inp" style={{fontSize:11.5}} value={d.long} placeholder="Monday, April 14th 2026"
                    onChange={e=>{const nd=[...config.days];nd[di]={...nd[di],long:e.target.value};setConfig(c=>({...c,days:nd}));}}/></div>
                <div style={{flexShrink:0}}>
                  {(config.days||DEFAULT_DAYS).length>1&&<button className="btn bd bs" onClick={()=>setConfig(c=>({...c,days:c.days.filter((_,j)=>j!==di)}))}>✕</button>}
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
                <button className="btn bd bs" style={{alignSelf:"flex-end"}} onClick={()=>setConfig(cfg=>({...cfg,contacts:cfg.contacts.filter((_,j)=>j!==i)}))}>✕</button>
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
            <div className="upz" onClick={()=>fileRef.current?.click()}>
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
            <div className="upz" style={{padding:"18px 20px"}} onClick={()=>prevYearRef.current?.click()}>
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
              <div key={inv.id} className="ent-row" onClick={()=>setInvProfile(inv)}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontFamily:"Playfair Display,serif",fontSize:14,color:"var(--cream)"}}>{inv.name}</span>
                    {(inv.blockedSlots||[]).length>0&&<span className="bdg bg-r">{inv.blockedSlots.length} bloq.</span>}
                  </div>
                  <div style={{fontSize:11,color:"var(--dim)",marginTop:2}}>{inv.fund&&<strong style={{color:"var(--txt)"}}>{inv.fund}</strong>}{inv.position&&<> · {inv.position}</>}{inv.aum&&<span className="bdg bg-g" style={{marginLeft:6}}>{inv.aum}</span>}</div>
                  <div style={{marginTop:4,display:"flex",flexWrap:"wrap",gap:3}}>
                    {(inv.companies||[]).map(cid=>{const c=companies.find(x=>x.id===cid);return<span key={cid} className="tag" style={{borderColor:`${SEC_CLR[c?.sector]||"var(--gold)"}44`,color:SEC_CLR[c?.sector]||"var(--gold2)"}}>{c?.ticker||cid}</span>;})}
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
                if(companies.find(c=>c.id===id)){alert("Ticker already exists");return;}
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
          {!scheduled&&investors.length===0&&<div className="alert aw">Cargá el archivo Excel primero.</div>}
          {!scheduled&&investors.length>0&&<div className="alert ai">{investors.length} inversores listos. <button className="btn bg bs" style={{marginLeft:10}} onClick={generate}>🚀 Generar</button></div>}
          {scheduled&&(<>
            <div className="stats">
              <div className="stat"><div className="sv">{meetings.length}</div><div className="sl">Reuniones</div></div>
              <div className="stat"><div className="sv" style={{color:unscheduled.length?"var(--red)":undefined}}>{unscheduled.length}</div><div className="sl" style={{color:unscheduled.length?"var(--red)":undefined}}>Sin asignar</div></div>
              <div className="stat"><div className="sv">{meetings.filter(m=>slotDay(m.slotId)===getDayIds(config)[0]).length}</div><div className="sl" style={{color:"var(--blu)"}}>{getDayShort(config)[getDayIds(config)[0]]||'Day 1'}</div></div>
              <div className="stat"><div className="sv">{meetings.filter(m=>slotDay(m.slotId)===getDayIds(config)[1]).length}</div><div className="sl" style={{color:"var(--grn)"}}>{getDayShort(config)[getDayIds(config)[1]]||'Day 2'}</div></div>
              <div className="stat"><div className="sv">{meetings.filter(m=>{const invs=(m.invIds||[]).map(id=>investors.find(i=>i.id===id)).filter(Boolean);return new Set(invs.map(i=>i.fund||i.id)).size>1;}).length}</div><div className="sl">Grupales</div></div>
            </div>
            {unscheduled.length>0&&<div className="alert aw" style={{marginBottom:12}}>⚠ {unscheduled.length} reunión(es) sin asignar.</div>}
            {/* ── Toolbar ── */}
            <div className="flex" style={{marginBottom:12,flexWrap:"wrap",gap:6}}>
              {getDayIds(config).map((d,di)=><button key={d} className={`day-btn ${activeDay===d?(di%2===0?"d14on":"d15on"):"doff"}`} onClick={()=>setActiveDay(d)}>
                {getDayShort(config)[d]||d}
                <span style={{opacity:.7,marginLeft:4}}>({meetings.filter(m=>slotDay(m.slotId)===d).length})</span>
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
              <span>✋ <strong>{companies.find(c=>c.id===meetings.find(x=>x.id===moveSrc)?.coId)?.ticker||"Reunión"}</strong> seleccionada para mover — hacé clic en una celda vacía para colocarla.</span>
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
                            const invs=(m.invIds||[]).map(id=>investors.find(i=>i.id===id)).filter(Boolean);
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
                            const co=companies.find(c=>c.id===m.coId);
                            const invs=(m.invIds||[]).map(id=>investors.find(i=>i.id===id)).filter(Boolean);
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
                    <td>{(u.invIds||[]).map(id=>investors.find(x=>x.id===id)?.name).join(", ")}</td>
                    <td>{companies.find(c=>c.id===u.coId)?.name}</td>
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
          {!scheduled&&<div className="alert aw">Generá la agenda primero.</div>}
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
              <div className="ex-card" onClick={exportExcel} style={{border:"1px solid rgba(51,153,255,.3)",background:"rgba(51,153,255,.04)"}}>
                <div className="ex-card-ico">🟦📊</div>
                <div className="ex-card-t">Agenda Completa — Excel</div>
                <div className="ex-card-s">4 solapas: agenda, por compañía, por inversor, lista. Colores Latin Securities.</div>
              </div>
            </div>
            <div className="sec-hdr" style={{marginBottom:8}}>🏢 Por Compañía</div>
            <div className="g2" style={{marginBottom:20}}>
              <div className="ex-card" onClick={()=>exportAll("companies","word")}><div className="ex-card-ico">📝🗜</div><div className="ex-card-t">Todas — Word ZIP</div><div className="ex-card-s">Un .doc por compañía en un ZIP.</div></div>
              <div className="ex-card" onClick={()=>exportAll("companies","pdf_combined")}><div className="ex-card-ico">📄</div><div className="ex-card-t">Todas — PDF combinado</div><div className="ex-card-s">Un solo PDF con todas las compañías.</div></div>
            </div>
            <div className="sec-hdr" style={{marginBottom:8}}>💼 Por Inversor</div>
            <div className="g2" style={{marginBottom:20}}>
              <div className="ex-card" onClick={()=>exportAll("investors","word")}><div className="ex-card-ico">📝🗜</div><div className="ex-card-t">Todos — Word ZIP</div><div className="ex-card-s">Un .doc por inversor en un ZIP.</div></div>
              <div className="ex-card" onClick={()=>exportAll("investors","pdf_combined")}><div className="ex-card-ico">📄</div><div className="ex-card-t">Todos — PDF combinado</div><div className="ex-card-s">Un solo PDF con todos los inversores.</div></div>
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


    </div>
  </div>
  );
}
