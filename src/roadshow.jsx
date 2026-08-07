// ── roadshow.js — roadshow constants, email generators, ICS ──
import { useState, useRef } from 'react';
import { stripNeighborhood, PLATFORM_LABELS, PLATFORM_ICONS, officeAddressOf, officeNameOf } from './travel.js';
import { esc, safeUrl } from './storage.jsx';

/* ═══════════════════════════════════════════════════════════════════
   ROADSHOW SCHEDULER
═══════════════════════════════════════════════════════════════════ */
// Hours in 30-min increments: 8.0, 8.5, 9.0, ... 20.0
export const ROADSHOW_HOURS =Array.from({length:25},(_,i)=>8+i*0.5);

// ── Multi-fund support ─────────────────────────────────────────────
// A virtual/hybrid roadshow can invite multiple funds simultaneously: some
// meetings are common (everyone joins), others are fund-specific. The PRIMARY
// fund lives in `trip.fund/clientName/visitors` (id = "__primary"); additional
// funds live in `trip.funds[]`. Meetings carry an `attendingFundIds[]` array —
// empty means "everyone attends".
export const PRIMARY_FUND_ID="__primary";

// Return the unified [primary, ...additional] funds list for a trip.
// Always returns at least one entry (the primary, even if blank).
export function getAllFunds(trip){
  if(!trip) return [{id:PRIMARY_FUND_ID,fund:"",clientName:"",visitors:[]}];
  const primary={id:PRIMARY_FUND_ID,fund:trip.fund||"",clientName:trip.clientName||"",visitors:trip.visitors||[]};
  return [primary,...(trip.funds||[])];
}

// True when the trip has at least one additional fund beyond the primary.
export function isMultiFund(trip){return (trip?.funds||[]).length>0;}

// Friendly label for a fund (fund name OR clientName OR fallback).
export function fundLabel(f){return f?.fund||f?.clientName||"Fondo sin nombre";}

// Filter meetings for a specific fund. Pass fundId=null for "combined" view.
// A meeting belongs to fundId when its attendingFundIds is empty (common) OR
// it explicitly includes fundId. Pass `allFundIds` (the trip's current roster)
// so that a meeting whose attendingFundIds references only DELETED funds is
// treated as "common" rather than silently disappearing from every per-fund PDF.
export function meetingsForFund(meetings, fundId, allFundIds=null){
  if(!fundId) return meetings||[];
  const roster=allFundIds?new Set(allFundIds):null;
  return (meetings||[]).filter(m=>{
    const ids=m.attendingFundIds||[];
    if(ids.length===0) return true;
    // If every referenced fund id is missing from the current roster, the
    // meeting has been orphaned — surface it as common rather than hide it.
    if(roster&&ids.every(id=>!roster.has(id))) return true;
    return ids.includes(fundId);
  });
}
export function fmtHour(h){const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");}
// Local-date "today" (YYYY-MM-DD) — toISOString() is UTC and flips to tomorrow at 21:00 in BA.
export const todayLocal=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};

// ── Timezone support ───────────────────────────────────────────────
// Base timezone for all stored meeting times: Buenos Aires (UTC-3, no DST)
export const BASE_TZ="America/Argentina/Buenos_Aires";
// Curated list of timezones useful for investor roadshows
export const TIMEZONES=[
  {value:BASE_TZ,label:"🇦🇷 Buenos Aires · BA time",short:"BA"},
  {value:"America/New_York",label:"🇺🇸 New York · ET",short:"ET"},
  {value:"America/Chicago",label:"🇺🇸 Chicago · CT",short:"CT"},
  {value:"America/Los_Angeles",label:"🇺🇸 Los Angeles · PT",short:"PT"},
  {value:"America/Sao_Paulo",label:"🇧🇷 São Paulo · BRT",short:"BRT"},
  {value:"America/Santiago",label:"🇨🇱 Santiago",short:"CL"},
  {value:"Europe/London",label:"🇬🇧 London · UK time",short:"UK"},
  {value:"Europe/Madrid",label:"🇪🇸 Madrid · CET",short:"CET"},
  {value:"Europe/Zurich",label:"🇨🇭 Zurich · CET",short:"CET"},
  {value:"Asia/Dubai",label:"🇦🇪 Dubai · GST",short:"GST"},
  {value:"Asia/Hong_Kong",label:"🇭🇰 Hong Kong · HKT",short:"HKT"},
  {value:"Asia/Singapore",label:"🇸🇬 Singapore · SGT",short:"SGT"},
  {value:"Asia/Tokyo",label:"🇯🇵 Tokyo · JST",short:"JST"},
];

// Format a BA-time meeting (`date` YYYY-MM-DD + `baHour` decimal 14.5)
// in the target timezone. Returns "HH:mm" (24h). When targetTz === BASE_TZ
// we skip the conversion to avoid any rounding quirks.
export function fmtHourInTZ(date, baHour, targetTz=BASE_TZ){
  // Treat 0 (midnight) as a valid hour. Only bail on null/undefined/"".
  if(baHour==null||baHour==="") return "";
  baHour=Number(baHour);
  if(Number.isNaN(baHour)) return "";
  const hh=Math.floor(baHour);
  const mm=Math.round((baHour-hh)*60);
  if(!targetTz||targetTz===BASE_TZ){
    return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");
  }
  try{
    // BA is UTC-3 year-round (no DST). Build an absolute instant from this.
    const baIso=`${date||"2026-01-01"}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00-03:00`;
    const d=new Date(baIso);
    return new Intl.DateTimeFormat("en-GB",{timeZone:targetTz,hour:"2-digit",minute:"2-digit",hour12:false}).format(d);
  }catch{
    return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");
  }
}

// Same instant in target TZ but returns the calendar date (YYYY-MM-DD).
// Useful for grouping when crossing midnight (e.g. BA evening → Tokyo next day).
export function dateInTZ(date, baHour, targetTz=BASE_TZ){
  if(!date) return "";
  if(!targetTz||targetTz===BASE_TZ) return date;
  try{
    const hh=Math.floor(baHour||0), mm=Math.round(((baHour||0)-hh)*60);
    const baIso=`${date}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00-03:00`;
    const d=new Date(baIso);
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:targetTz,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
    const get=t=>parts.find(p=>p.type===t)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }catch{ return date; }
}

// Pretty offset label for a TZ, e.g. "GMT-4" — uses current date so DST is accurate.
export function tzOffsetLabel(tz){
  try{
    const parts=new Intl.DateTimeFormat("en-US",{timeZone:tz,timeZoneName:"shortOffset"}).formatToParts(new Date());
    return parts.find(p=>p.type==="timeZoneName")?.value||"";
  }catch{return "";}
}

// Format a date range; collapses to a single date when arrival===departure (e.g. one-day roadshow)
// opts: { locale: "es-AR" | "en-US", short: bool, withYear: bool, sep: " – " }
export function fmtDateRange(arrival, departure, opts={}){
  const {locale="en-US",short=true,withYear=false,sep=" – "}=opts;
  if(!arrival&&!departure) return "";
  const oneDay=arrival&&departure&&arrival===departure;
  const fmt=iso=>{
    if(!iso) return "";
    const d=new Date(iso+"T12:00:00");
    const o=short?{month:"short",day:"numeric",...(withYear?{year:"numeric"}:{})}:{day:"numeric",month:"long",...(withYear?{year:"numeric"}:{})};
    return d.toLocaleDateString(locale,o);
  };
  if(oneDay||(arrival&&!departure)) return fmt(arrival||departure);
  if(!arrival&&departure) return fmt(departure);
  return fmt(arrival)+sep+fmt(departure);
}

// Natural-language join: ["A"]→"A", ["A","B"]→"A and B", ["A","B","C"]→"A, B and C"
// `connector` is the final separator ("and" / "y")
export function joinNames(arr,connector="and"){
  const a=(arr||[]).filter(Boolean);
  if(!a.length) return "";
  if(a.length===1) return a[0];
  if(a.length===2) return `${a[0]} ${connector} ${a[1]}`;
  return a.slice(0,-1).join(", ")+` ${connector} `+a[a.length-1];
}
export const RS_CLR ={"Financials":"#1e5ab0","Energy":"#e8850a","TMT":"#7b35b0","Infra":"#3a6b3a","Real Estate":"#b03535","Agro":"#3a8c5c","Consumer":"#2a7a8a","Exchange":"#374551","Industry":"#5a5a2e","Media":"#a05000","LS Internal":"#23a29e","Custom":"#666"};
export const LS_INT_TYPES =["Research – Equities","Research – Fixed Income","Corporate Finance","Economics & Strategy","Political Analyst","Breakfast / Networking Lunch","Airport Transfer","Internal LS Meeting","Dinner","Free time"];
export const RS_TRIP_DEF ={clientName:"",fund:"",hotel:"Holiday Inn",arrivalDate:"2026-04-18",departureDate:"2026-04-24",lsContactIdx:0,notes:"",officeAddress:"Arenales 707, 6° Piso, CABA",meetingDuration:60,visitors:[],lsTeam:[],mapsApiKey:"",resendKey:""};
export const RS_COS_DEF =[
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
// Free hour candidates for proposing meetings. A candidate is blocked when any
// non-cancelled meeting OVERLAPS [candidate, candidate+dur) — the old Set only
// matched exact start hours, so half-hour meetings, long durations and cancelled
// rows produced double-booked proposals in the request emails.
export function freeMeetingSlots(meetings, tripDays, defaultDur=60){
  const act=(meetings||[]).filter(m=>m.status!=="cancelled");
  const workDays=(tripDays||[]).filter(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;});
  const free=[];
  for(const day of workDays){
    const dayMs=act.filter(m=>m.date===day);
    for(const h of [9,10,11,12,14,15,16,17]){
      const end=h+defaultDur/60;
      const clash=dayMs.some(m=>{const mEnd=m.hour+(m.duration||defaultDur)/60;return h<mEnd&&end>m.hour;});
      if(!clash) free.push({day,h});
    }
  }
  return free;
}
export function genRSEmail(co,trip,meetings,lsContact,tripDays){
  const free=freeMeetingSlots(meetings,tripDays,trip.meetingDuration||60);
  const fmtD=iso=>{const s=new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});return s.charAt(0).toUpperCase()+s.slice(1);};
  const arr=fmtD(trip.arrivalDate||"2026-04-18");
  const dep=fmtD(trip.departureDate||"2026-04-24");
  const visitors=(trip.visitors||[]).filter(v=>v.name);
  const visNames=visitors.length>0?visitors.map(v=>v.name+(v.title?` (${v.title})`:"")):[(trip.clientName||"el cliente")];
  const cli=trip.fund?(trip.clientName?`${trip.fund} (${trip.clientName})`:`${trip.fund}`):(trip.clientName||"[cliente]");
  const visitorLine=visitors.length>1?`los siguientes representantes de ${cli}: ${visNames.join(", ")}`:`${visNames[0]} de ${cli}`;
  const loc=co.location==="virtual"?`virtualmente${trip.defaultMeetingLink?" ("+(PLATFORM_LABELS[co.meetingPlatform||"other"]||"videollamada")+")":""}`:co.location==="ls_office"?`en nuestras oficinas (${trip.officeAddress||"Arenales 707, 6° Piso, CABA"})`:co.location==="hq"?`en la sede de ${co.name}`:`en ${co.locationCustom||"un lugar a coordinar"}`;
  const fmtHe=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
  const slots=free.slice(0,6).map(({day,h})=>`• ${fmtD(day)} a las ${fmtHe(h)} hs`).join("\n")||"• A coordinar según disponibilidad";
  const subj=`Solicitud de reunión – ${co.name} / ${trip.fund||trip.clientName||"[cliente]"} | Latin Securities`;
  const primaryContact=(co.contacts||[])[0];
  const oneDay=trip.arrivalDate&&trip.departureDate&&trip.arrivalDate===trip.departureDate;
  const visitPhrase=oneDay?`quienes estarán visitando Buenos Aires el ${arr}`:`quienes estarán visitando Buenos Aires entre el ${arr} y el ${dep}`;
  const body=`Estimado/a ${primaryContact?.name||co.contact?.name||"[Nombre del contacto]"},\n\nMe comunico desde Latin Securities para coordinar una reunión entre el equipo de ${co.name} y ${visitorLine||cli}, ${visitPhrase}, hospedándose en el ${trip.hotel||"[hotel]"}.\n\nNos gustaría solicitar una reunión de aproximadamente ${trip.meetingDuration||60} minutos. La misma podría realizarse ${loc}, según la conveniencia del equipo.\n\nLes proponemos los siguientes horarios disponibles:\n${slots}\n\nEn caso de preferir otro horario, quedamos totalmente disponibles para ajustar la agenda.\n\nMuchas gracias y saludos cordiales,\n\n${lsContact?.name||"[Nombre LS]"}\n${lsContact?.role||"Institutional Sales"}\nLatin Securities${lsContact?.email?"\n"+lsContact.email:""}${lsContact?.phone?" · "+lsContact.phone:""}`;
  return{to:primaryContact?.email||co.contact?.email||"",subject:subj,body};
}
export function rsToEntity(rs,rsCos,opts={}){
  const{trip,meetings}=rs;
  const tz=opts.tz||BASE_TZ;
  const isOtherTz=tz!==BASE_TZ;
  // Optional per-fund filter. null/undefined ⇒ combined (all meetings).
  // Otherwise we keep only meetings that fund attends (common + that fund's specific).
  const fundId=opts.fundId||null;
  const allFunds=getAllFunds(trip);
  const filteredMeetings=fundId?meetingsForFund(meetings,fundId,allFunds.map(f=>f.id)):(meetings||[]);
  // Resolve the selected fund (if any) so the cover can show its name/visitors.
  const selectedFund=fundId?allFunds.find(f=>f.id===fundId):null;
  const rm=new Map((rsCos||[]).map(c=>[c.id,c]));
  // Group by target-tz date so meetings that cross midnight under conversion
  // (BA evening → Tokyo next day, etc.) land in the right day section.
  const byDay={};filteredMeetings.forEach(m=>{
    const d=isOtherTz?dateInTZ(m.date,m.hour,tz):m.date;
    if(!byDay[d])byDay[d]=[];byDay[d].push(m);
  });
  Object.values(byDay).forEach(arr=>arr.sort((a,b)=>{
    const ta=isOtherTz?fmtHourInTZ(a.date,a.hour,tz):a.hour;
    const tb=isOtherTz?fmtHourInTZ(b.date,b.hour,tz):b.hour;
    return typeof ta==="string"?ta.localeCompare(tb):ta-tb;
  }));
  const days=Object.keys(byDay).sort();
  if(!days.length) return null;
  const fmtH=(h,date)=>isOtherTz?fmtHourInTZ(date,h,tz):(()=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");})();
  const fmtLong=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const fmtShort=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
  // When exporting per-fund, override visitors + fund label with the selected
  // fund's data so the cover page reads "Templeton" with their visitors instead
  // of the primary fund's. Combined export keeps the primary fund's identity.
  const effVisitors=selectedFund?(selectedFund.visitors||[]).filter(v=>v.name):((trip.visitors||[]).filter(v=>v.name));
  const effFundName=selectedFund?(selectedFund.fund||selectedFund.clientName||"Fondo"):(trip.fund||trip.clientName||"Roadshow");
  const effClientName=selectedFund?(selectedFund.clientName||""):trip.clientName;
  const visLine=effVisitors.length?effVisitors.map(v=>[v.name,v.title].filter(Boolean).join(" · ")).join(" | "):(effClientName||"");
  // Subtitle: fund + visitors only — date is already on the cover page and per-day headers
  const sub=`${effFundName||"Buenos Aires Roadshow"}${visLine?" · "+visLine:""}`;
  // Title: when 2+ visitors, show fund only (visitors are already listed in sub) so no single
  // person "heads" the document. With 0-1 visitor, fall back to "Name — Fund".
  const titleName=effVisitors.length>=2
    ?effFundName
    :`${effClientName||effVisitors[0]?.name||"[Client]"}${effFundName&&effFundName!==effClientName?" — "+effFundName:""}`;
  return{name:titleName,sub,
    coverTitle:effFundName,
    coverNames:effVisitors.map(v=>({name:v.name,title:v.title||""})),
    coverDate:(()=>{
      const d=trip.arrivalDate||trip.departureDate;if(!d)return"";
      // For non-BA exports, shift to target-tz date so cover month/year matches the agenda inside
      const effDate=isOtherTz?dateInTZ(d,12,tz):d;
      return new Date(effDate+"T12:00:00").toLocaleDateString("en-US",{month:"long",year:"numeric"});
    })(),
    visitors:effVisitors.map(v=>v.name+(v.title?" · "+v.title:"")),
    sections:days.map(date=>({dayLabel:fmtLong(date),headerCols:["Time","Company / Meeting","Representatives","Type","Location","Status"],
    rows:byDay[date].flatMap((m,idx)=>{const co=m.type==="company"?rm.get(m.companyId):null;
      // Short location label for the "Travel from X to Y" travel row.
      const shortLoc=(mm)=>{
        if(!mm) return "";
        const c=mm.type==="company"?rm.get(mm.companyId):null;
        if(mm.location==="virtual") return PLATFORM_LABELS[mm.meetingPlatform]||"Virtual";
        if(mm.location==="ls_office") return officeNameOf(mm);
        if(mm.location==="hq") return c?c.name:"HQ";
        return mm.locationCustom||"destino";
      };
      // Travel row before this meeting (skip the first of the day, skip if 0 min)
      const travelRows=[];
      if(idx>0&&m.travelMinutes>0){
        const prev=byDay[date][idx-1];
        travelRows.push({travelRow:true,travelText:`Travel from ${shortLoc(prev)} to ${shortLoc(m)} · approx. ${m.travelMinutes} min`});
      }
      const rawLoc=m.location==="virtual"?((PLATFORM_ICONS[m.meetingPlatform]||"💻")+" "+(PLATFORM_LABELS[m.meetingPlatform]||"Virtual")):m.location==="ls_office"?officeAddressOf(m,trip):m.location==="hq"?(co?co.hqAddress||co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
      const locL=m.location==="virtual"?rawLoc:stripNeighborhood(rawLoc);
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
      // Tappable Maps link for physical locations — the agenda PDF is read on a phone
      const col4url=(m.location!=="virtual"&&rawLoc&&!/TBD/.test(rawLoc))?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawLoc)}`:null;
      return[...travelRows,{time:fmtH(m.hour,m.date),col1:col1Name,col1b:null,col1c:null,col1html:false,col1chtml:false,
        col2:reps||"",col2html:false,col3:fmt,col3html:false,col4:locL,col4url,col5:st}];})
  })),
  // Contacts directory (one entry per company with a meeting) — rendered by
  // buildPrintHTML as a final page so the client has someone to call en route.
  directory:(()=>{
    const seen=new Set();const dir=[];
    filteredMeetings.filter(m=>m.type==="company").forEach(m=>{
      const c=rm.get(m.companyId);
      if(c&&!seen.has(c.id)){seen.add(c.id);dir.push({name:c.name,ticker:c.ticker||"",hqAddress:c.hqAddress||"",reps:(c.contacts||[]).filter(r=>r.name)});}
    });
    dir.sort((a,b)=>a.name.localeCompare(b.name));
    return dir;
  })(),
  // Optional banner for the PDF when times are not BA local
  tzBanner:isOtherTz?(()=>{
    const lbl=(TIMEZONES.find(t=>t.value===tz)?.label||tz).replace(/^[^ ]+ /,"");
    const off=tzOffsetLabel(tz);
    return `All times shown in ${lbl}${off?` (${off})`:""}.`;
  })():""
  };
}



/* ─── ICS Import — parse .ics → meetings ────────────────────── */
export function parseICS(icsText){
  const events=[];
  const raw=icsText.replace(/\r\n/g,"\n").replace(/\r/g,"\n");
  // Unfold lines (continuation lines start with space or tab)
  const unfolded=raw.replace(/\n[ \t]/g,"");
  const blocks=unfolded.split("BEGIN:VEVENT");
  blocks.slice(1).forEach(block=>{
    const get=key=>{
      const re=new RegExp("^"+key+"(?:;[^:\n]*)?:(.*)$","m");
      const m=block.match(re);
      if(!m) return "";
      return m[1].replace(/\\n/g,"\n").replace(/\\,/g,",").replace(/\\;/g,";").trim();
    };
    const dtstart=get("DTSTART");
    const dtend=get("DTEND");
    const summary=get("SUMMARY")||"Imported Meeting";
    const location=get("LOCATION")||"";
    const url=get("URL")||"";
    const desc=get("DESCRIPTION")||"";
    const uid=get("UID")||("imp-"+Date.now()+"-"+Math.random().toString(36).slice(2,6));
    function parseDT(dt){
      if(!dt) return null;
      // Strip TZID prefix if any
      const val=dt.includes(":")?dt.split(":").pop():dt;
      const m=val.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/);
      if(m){
        const isUTC=val.endsWith("Z");
        if(isUTC){
          const utcD=new Date(m[1]+"-"+m[2]+"-"+m[3]+"T"+m[4]+":"+m[5]+":00Z");
          // Buenos Aires = UTC-3
          const baD=new Date(utcD.getTime()-3*3600000);
          return{date:baD.toISOString().slice(0,10),hour:baD.getUTCHours()+baD.getUTCMinutes()/60};
        }
        return{date:m[1]+"-"+m[2]+"-"+m[3],hour:parseInt(m[4])+parseInt(m[5])/60};
      }
      const d=val.match(/^(\d{4})(\d{2})(\d{2})$/);
      if(d) return{date:d[1]+"-"+d[2]+"-"+d[3],hour:9};
      return null;
    }
    const start=parseDT(dtstart);
    const end=parseDT(dtend);
    if(!start) return;
    const durMin=end?Math.max(30,Math.round((end.hour-start.hour)*60)):60;
    // Detect virtual meeting from URL/location/description
    const stripTrail=u=>u.replace(/[.,;:!?)\]>]+$/,""); // strip trailing punctuation that's typically not part of the URL
    const possibleLink=stripTrail(url||(/(https?:\/\/[^\s,;]+)/.exec(location)?.[1]||"")||(/(https?:\/\/[^\s,;]+)/.exec(desc)?.[1]||""));
    const isVirtual=!!possibleLink&&/(zoom|teams\.microsoft|teams\.live|meet\.google|webex)/i.test(possibleLink);
    events.push({uid,title:summary,date:start.date,hour:Math.round(start.hour*2)/2,
      duration:durMin,
      location:isVirtual?"virtual":undefined,
      meetingLink:isVirtual?possibleLink:"",
      locationCustom:isVirtual?"":location,
      notes:desc.slice(0,300)});
  });
  return events;
}

/* ─── ICS Calendar Export ─────────────────────────────────────── */
export function buildICS(meetings, companies, trip){
  const rsCoMap=new Map((companies||[]).map(c=>[c.id,c]));
  const pad=n=>String(n).padStart(2,"0");
  const fmtNow=()=>{const n=new Date();return n.getUTCFullYear()+pad(n.getUTCMonth()+1)+pad(n.getUTCDate())+"T"+pad(n.getUTCHours())+pad(n.getUTCMinutes())+pad(n.getUTCSeconds())+"Z";};
  // Explicit BA offset (-03:00, no DST): the export must not depend on the
  // exporting laptop's timezone. And half-hours: pad(9.5)="9.5" produced an
  // Invalid Date → DTSTART:NaN... that calendar clients reject.
  const baDate=(dateStr,hour)=>{
    const hh=Math.floor(hour), mm=Math.round((hour-hh)*60);
    return new Date(`${dateStr}T${pad(hh)}:${pad(mm)}:00-03:00`);
  };
  const fmtUTC=d=>d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+"T"+pad(d.getUTCHours())+pad(d.getUTCMinutes())+"00Z";
  const fmtDT=(dateStr,hour)=>fmtUTC(baDate(dateStr,hour));
  const esc=s=>(s||"").replace(/[\,;]/g,"\\$&").replace(/\n/g,"\\n");
  const dur=trip.meetingDuration||60;
  const events=meetings.filter(m=>m.status!=="cancelled").map(m=>{
    const co=m.type==="company"?rsCoMap.get(m.companyId):null;
    const title=co?`${co.name} / ${trip.fund||trip.clientName||"Roadshow"}`:(m.lsType||m.title||"Internal Meeting");
    const isVirt=m.location==="virtual";
    const platLabel=PLATFORM_LABELS[m.meetingPlatform]||"Virtual meeting";
    // For virtual meetings, LOCATION is the friendly platform label.
    // The clickable meeting link lives in URL: (RFC 5545 §3.8.4.6) — Outlook/Apple/GCal
    // render it as a "Join meeting" button. Putting the URL itself in LOCATION confuses
    // some clients (line breaks at colon, garbled rendering).
    const locL=isVirt?platLabel:m.location==="ls_office"?officeAddressOf(m,trip):m.location==="hq"?(co?co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
    const start=fmtDT(m.date,m.hour);
    const mDur=m.duration||dur;
    const endDT=fmtUTC(new Date(baDate(m.date,m.hour).getTime()+mDur*60000));
    const uid=`rs-${m.id}@latinsecurities.ar`;
    const attendees=(trip.visitors||[]).filter(v=>v.email).map(v=>`ATTENDEE;CN="${esc(v.name)}":mailto:${v.email}`).join("\r\n");
    // Use meeting-specific selected reps, fall back to all contacts
    const allCoContacts=co?.contacts||[];
    const selIds=m.attendeeIds||[];
    const mtgReps=selIds.length>0?allCoContacts.filter(r=>selIds.includes(r.id)):allCoContacts;
    const coContactLines=mtgReps.filter(r=>r.email).map(r=>`ATTENDEE;CN="${esc(r.name)}":mailto:${r.email}`).join("\r\n");
    const coContact=coContactLines||( co?.contact?.email?`ATTENDEE;CN="${esc(co.contact?.name||co.name)}":mailto:${co.contact.email}`:"");
    const seq=m.icsVersion||0;
    const urlLine=isVirt&&m.meetingLink?`URL:${m.meetingLink}\r\n`:"";
    const descBase=(co?.notes||"")+( m.notes?("\n"+m.notes):"");
    const desc=isVirt&&m.meetingLink?`${platLabel}\nJoin: ${m.meetingLink}${descBase?"\n\n"+descBase:""}`:descBase;
    return `BEGIN:VEVENT\r\nUID:${uid}\r\nSEQUENCE:${seq}\r\nDTSTAMP:${fmtNow()}\r\nLAST-MODIFIED:${fmtNow()}\r\nDTSTART:${start}\r\nDTEND:${endDT}\r\nSUMMARY:${esc(title)}\r\nLOCATION:${esc(locL)}\r\n${urlLine}DESCRIPTION:${esc(desc)}\r\n${attendees?attendees+"\r\n":""}${coContact?coContact+"\r\n":""}END:VEVENT`;
  });
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Latin Securities//Roadshow//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:REQUEST\r\n${events.join("\r\n")}\r\nEND:VCALENDAR`;
}

/* ─── Booking Page HTML Generator ───────────────────────────────── */
export function buildBookingPage(trip, companies, meetings, officeAddress){
  // Duration-aware busy check (same rationale as freeMeetingSlots): a 60'
  // meeting at 10:00 must also block the 10:30 candidate.
  const actMs=(meetings||[]).filter(m=>m.status!=="cancelled");
  const defDur=trip.meetingDuration||60;
  const slotBusy=(day,h)=>actMs.some(m=>{
    if(m.date!==day) return false;
    const mEnd=m.hour+(m.duration||defDur)/60;
    return h<mEnd&&(h+defDur/60)>m.hour;
  });
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
      if(!slotBusy(day,h)) slots.push({day,h});
    }
  }
  const fmtDay=iso=>new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
  const fund=trip.fund||trip.clientName||"Inversores";
  // Values that get interpolated inside a `<script>` element need both JSON
  // string escaping AND `<` neutralisation — JSON.stringify alone doesn't
  // touch `<`, so a literal `</script>` inside the string would close the
  // script element to the HTML parser. `<` is identical to `<` once the
  // JS string is parsed but is invisible to the HTML tokeniser.
  const jsLit=s=>JSON.stringify(String(s==null?"":s)).replace(/</g,"\\u003c");
  const slotList=slots.map(({day,h})=>`{id:${jsLit(`${day}-${h}`)},day:${jsLit(fmtDay(day))},hour:${h}}`).join(",");

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Solicitar horario — ${esc(fund)} | Latin Securities</title>
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
<div class="hdr"><h1>📅 Solicitar horario de reunión</h1><p>${esc(fund)} · ${trip.mode==="virtual"?"Roadshow virtual":"Buenos Aires"} · ${esc(fmtDateRange(trip.arrivalDate||"",trip.departureDate||"",{locale:"es-AR",short:false}))}</p>${trip.mode==="virtual"?'<p style="margin-top:8px;padding:5px 10px;background:rgba(255,255,255,.1);border-radius:5px;font-size:12px;display:inline-block">💻 Todas las reuniones por videollamada</p>':trip.mode==="hybrid"?'<p style="margin-top:8px;padding:5px 10px;background:rgba(255,255,255,.1);border-radius:5px;font-size:12px;display:inline-block">🔀 Modalidad híbrida — presencial o virtual</p>':""}</div>
<div class="card"><h2>Seleccioná un horario disponible</h2>
<div id="slotContainer"></div></div>
<div class="card" id="formCard" style="display:none"><h2>Tus datos</h2>
<div class="form-row"><label>Empresa *</label><input id="fCompany" placeholder="Nombre de la empresa"/></div>
<div class="form-row"><label>Nombre del representante *</label><input id="fName" placeholder="Juan Pérez"/></div>
<div class="form-row"><label>Email *</label><input id="fEmail" type="email" placeholder="jperez@empresa.com"/></div>
<div class="form-row"><label>Teléfono (opcional)</label><input id="fPhone" placeholder="+54 11..."/></div>
<div class="form-row"><label>${trip.mode==="virtual"?"Modalidad":"Lugar de preferencia"}</label>
<select id="fLoc" onchange="document.getElementById('linkRow').style.display=this.value==='virtual'?'block':'none'">${trip.mode==="virtual"?"":`<option value="ls_office">Oficinas Latin Securities (${esc(officeAddress||"Arenales 707, 6° Piso, CABA")})</option><option value="hq">Nuestra sede / headquarters</option><option value="other">Otro (aclarar en notas)</option>`}${trip.mode==="virtual"||trip.mode==="hybrid"?'<option value="virtual">💻 Reunión virtual (Zoom / Teams / Meet)</option>':""}</select></div>
<div class="form-row" id="linkRow" style="display:${trip.mode==="virtual"?"block":"none"}"><label>🔗 Link de la reunión (opcional)</label><input id="fLink" placeholder="https://zoom.us/j/... o https://teams.microsoft.com/..."/></div>
<div class="form-row"><label>Notas adicionales (opcional)</label><textarea id="fNotes" rows="2" placeholder="Asistentes, requerimientos especiales..."></textarea></div>
<button class="btn-submit" id="btnSubmit" onclick="submitBooking()">✓ Confirmar solicitud</button></div>
<div class="success" id="successBox"><h3>✅ Solicitud enviada</h3><p>Copiá el código de confirmación y enviáselo a Latin Securities:</p><div class="copy-box" id="confirmCode"></div></div>
</div>
<script>
const SLOTS=[${slotList}];
const FUND=${jsLit(fund)};
const TAKEN_KEY=${jsLit(`rs_taken_${trip.arrivalDate||""}${trip.departureDate||""}`)};
let selectedSlot=null;
const taken=JSON.parse(localStorage.getItem(TAKEN_KEY)||"{}");

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
  localStorage.setItem(TAKEN_KEY,JSON.stringify(taken));
  const code=btoa(JSON.stringify({slot:selectedSlot.id,company:co,name,email,fund:FUND,loc:document.getElementById("fLoc").value,link:document.getElementById("fLink")?.value||"",notes:document.getElementById("fNotes").value,ts:Date.now()}));
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
