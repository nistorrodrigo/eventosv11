/* LS Event Manager — modular build 2026 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { supabase } from "./supabase.js";
import * as XLSX from "xlsx";

// ── Constants & pure utils ─────────────────────────────────────────
import {
  ALL_HOURS, DEFAULT_DAYS, DAYS_STATIC, DAY_LONG_S, DAY_SHORT_S,
  DEFAULT_CONFIG, COMPANIES_INIT, CO_MAP, SEC_CLR, FUND_NOISE, TITLE_MAP,
  getDays, getDayIds, getDayLong, getDayShort,
  slotDay, slotHour, hourLabel, slotLabel, makeRooms, getRooms, makeSlots,
  parseAvail, capitalizeName, normalizeFund, buildFundAliasMap,
  normalizePosition, normalizeFundName, normalizeAUM,
  effectiveSlots, buildRoomMap, runSchedule,
} from "./src/constants.jsx";

// ── Storage, zip, HTML export ──────────────────────────────────────
import {
  LS_KEY, LS_DB_KEY, loadEvents, saveEvents, loadDB, saveDB,
  buildZip, downloadBlob, esc,
  buildWordHTML, buildPrintHTML, companyToEntity, investorToEntity,
} from "./src/storage.jsx";

// ── CSS ────────────────────────────────────────────────────────────
import { CSS } from "./src/styles.js";

// ── Roadshow: constants, email, ICS, booking ──────────────────────
import {
  ROADSHOW_HOURS, fmtHour, RS_CLR, LS_INT_TYPES, RS_TRIP_DEF, RS_COS_DEF,
  genRSEmail, rsToEntity, RoadshowAgendaEmailModal,
  parseICS, buildICS, buildBookingPage,
} from "./src/roadshow.jsx";

// ── Travel / geo routing ───────────────────────────────────────────
import {
  getMeetingAddress, cleanAddr,
  openGoogleMapsRoute, openGoogleMapsDirections, checkTravelConflict,
} from "./src/travel.js";

// ── UI Components ──────────────────────────────────────────────────
import { DatePicker, DayDateInput } from "./src/components/DatePicker.jsx";
import { INTEREST_LEVELS, FEEDBACK_TOPICS, NEXT_STEPS, FeedbackWidget } from "./src/components/FeedbackWidget.jsx";
import { KioskModal } from "./src/components/KioskModal.jsx";
import { RoadshowMeetingModal } from "./src/components/RoadshowMeetingModal.jsx";
import { RoadshowEmailModal } from "./src/components/RoadshowEmailModal.jsx";
import { InvestorModal } from "./src/components/InvestorModal.jsx";
import { CompanyModal } from "./src/components/CompanyModal.jsx";
import { MeetingModal } from "./src/components/MeetingModal.jsx";
import { DashboardView } from "./src/tabs/DashboardView.jsx";
import { RoadshowInboundTab } from "./src/tabs/RoadshowInboundTab.jsx";
import { RoadshowOutboundTab } from "./src/tabs/RoadshowOutboundTab.jsx";
import { LibraryTab } from "./src/tabs/LibraryTab.jsx";

export default function App(){
  // ── Events (persistence) ──────────────────────────────────────
  // ── Auth state ───────────────────────────────────────────────
  const [authUser,setAuthUser]   = useState(null);
  const [authLoading,setAuthLoading] = useState(true);
  const [authView,setAuthView]   = useState("login"); // "login"|"signup"
  const [authEmail,setAuthEmail] = useState("");
  const [authPwd,setAuthPwd]     = useState("");
  const [authName,setAuthName]   = useState("");
  const [authErr,setAuthErr]     = useState("");
  const [authBusy,setAuthBusy]   = useState(false);
  const [globalDB,setGlobalDB] = useState(()=>loadDB());
  function saveGlobalDB(db){setGlobalDB(db);saveDB(db);cloudSaveGlobalDB(db);}
  const [dbTab,setDbTab]       = useState("companies");  // companies | investors | fondos
  const [crmSearch,setCrmSearch] = useState("");
  const [crmFund,setCrmFund]   = useState(null); // selected fund name for detail view
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

  // Debounced cloud save — avoids Supabase write on every keystroke
  const _cloudSaveTimer=useRef(null);
  function saveCurrentEvent(patch){
    setEvents(prev=>{
      const next=prev.map(e=>e.id===activeEv?{...e,...patch}:e);
      saveEvents(next);
      const updated=next.find(e=>e.id===activeEv);
      if(updated){
        // Debounce: only push to Supabase after 1.5s of no changes
        clearTimeout(_cloudSaveTimer.current);
        _cloudSaveTimer.current=setTimeout(()=>cloudSaveEvent(updated),1500);
      }
      return next;
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
  const [rsDayFilter,setRsDayFilter]=useState(null); // null=all days, "YYYY-MM-DD"=single day
  const [kioskMode,setKioskMode]=useState(false);
  const [kioskIdx,setKioskIdx]=useState(0);
  const [kioskFb,setKioskFb]=useState(false);
  const [kioskFbData,setKioskFbData]=useState({});
  const [rsEmailModal,setRsEmailModal]=useState(null);
  const [rsSubTab,setRsSubTab]=useState("schedule");
  const [rsEmailParser,setRsEmailParser]=useState("");
  const [rsAgendaEmailModal,setRsAgendaEmailModal]=useState(false);
  const [icsImportModal,setIcsImportModal]=useState(null); // null | {events:[], pending:[]}  
  const [travelCache,setTravelCache]=useState({});
  const [travelLoading,setTravelLoading]=useState(false);
  const [dragMtg,setDragMtg]=useState(null); // {id, origDate, origHour}
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
  const [dashboardView,setDashboardView] = useState(false);
  const [globalSearch,setGlobalSearch] = useState("");
  const [showSearch,setShowSearch] = useState(false);
  const [searchFilter,setSearchFilter] = useState("all"); // "all"|"meeting"|"company"|"investor"|"db"
  const [searchStatus,setSearchStatus] = useState("all"); // "all"|"confirmed"|"tentative"
  const [evPasswordModal,setEvPasswordModal] = useState(null); // {evId, mode:"set"|"check", resolve}
  const [evPasswordInput,setEvPasswordInput] = useState("");
  const [showAddCo,setShowAddCo]   = useState(false);
  const [newCoForm,setNewCoForm]   = useState({name:"",ticker:"",sector:"Financials"});
  const fileRef = useRef();
  const scheduled = meetings.length>0;

  // ── Password helpers ─────────────────────────────────────────
  async function hashPwd(pwd){ const b=new TextEncoder().encode(pwd); const h=await crypto.subtle.digest("SHA-256",b); return Array.from(new Uint8Array(h)).map(x=>x.toString(16).padStart(2,"0")).join(""); }
  function setEvPassword(evId, pwd){
    hashPwd(pwd).then(hash=>{
      const next=events.map(e=>e.id===evId?{...e,passwordHash:pwd?hash:undefined}:e);
      setEvents(next); saveEvents(next);
      alert(pwd?"🔒 Contraseña configurada.":"🔓 Contraseña eliminada.");
    });
  }
  async function checkEvPassword(evId){
    const ev=events.find(e=>e.id===evId);
    if(!ev?.passwordHash) return true; // no password
    return new Promise(resolve=>{
      setEvPasswordModal({evId,mode:"check",resolve});
      setEvPasswordInput("");
    });
  }
  async function handleOpenEvent(evId){
    const ok=await checkEvPassword(evId);
    if(!ok) return;
    setActiveEv(evId);
    const ev=events.find(e=>e.id===evId);
    setTab(ev?.kind==="roadshow"?"roadshow":ev?.kind==="outbound"?"outbound":"upload");
    setShowEvMgr(false);
    setDashboardView(false);
  }

  // ── Duplicate event ───────────────────────────────────────────────────
  function duplicateEvent(evId){
    const orig=events.find(e=>e.id===evId); if(!orig) return;
    const id=`ev-${Date.now()}`;
    const dup={...orig,id,name:`${orig.name} (copia)`,createdAt:new Date().toISOString(),
      meetings:[],unscheduled:[],investors:[],
      roadshow:orig.roadshow?{...orig.roadshow,meetings:[]}:undefined,
      passwordHash:undefined};
    const next=[...events,dup]; setEvents(next); saveEvents(next);
    setActiveEv(id); cloudSaveEvent(dup); setShowEvMgr(false);
    setTab(dup.kind==="roadshow"?"roadshow":dup.kind==="outbound"?"outbound":"upload");
  }

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
    const next=[...events,ev]; setEvents(next); saveEvents(next); setActiveEv(id); setNewEvName(""); cloudSaveEvent(ev);
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
  function exportRoadshowSummary(){
    const {trip,meetings,companies}=roadshow;
    const rsCoMap=new Map((companies||[]).map(c=>[c.id,c]));
    const allMtgs=(meetings||[]).filter(m=>m.status!=="cancelled");
    const conf=allMtgs.filter(m=>m.status==="confirmed");
    const tent=allMtgs.filter(m=>m.status==="tentative");
    const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
    const fmtDate=iso=>new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"});
    // Group by sector
    const bySector={};
    allMtgs.forEach(m=>{
      const co=m.type==="company"?rsCoMap.get(m.companyId):null;
      const sec=co?.sector||"LS Internal";
      if(!bySector[sec])bySector[sec]={total:0,conf:0};
      bySector[sec].total++;
      if(m.status==="confirmed")bySector[sec].conf++;
    });
    // Group by day
    const byDay={};
    allMtgs.forEach(m=>{if(!byDay[m.date])byDay[m.date]=[];byDay[m.date].push(m);});
    Object.values(byDay).forEach(arr=>arr.sort((a,b)=>a.hour-b.hour));
    const days=Object.keys(byDay).sort();
    const visitorLine=(trip.visitors||[]).filter(v=>v.name).map(v=>v.name).join(", ")||trip.clientName||"—";
    const fund=trip.fund||trip.clientName||"Roadshow";
    const pct=allMtgs.length?Math.round(conf.length/allMtgs.length*100):0;
    const RS_CLR_MAP={"Financials":"#1e5ab0","Energy":"#e8850a","Utilities":"#23a29e","TMT":"#7c3aed","Infra":"#059669","Industry":"#b45309","Consumer":"#dc2626","Agro":"#65a30d","Exchange":"#0891b2","Real Estate":"#d97706","Other":"#6b7280","LS Internal":"#374151"};
    const sectorRows=Object.entries(bySector).sort((a,b)=>b[1].total-a[1].total).map(([sec,d])=>{
      const pctS=d.total?Math.round(d.conf/d.total*100):0;
      const clr=RS_CLR_MAP[sec]||"#6b7280";
      return `<tr><td style="padding:6px 12px;font-weight:600;color:${clr}">${sec}</td><td style="padding:6px 12px;text-align:center">${d.total}</td><td style="padding:6px 12px;text-align:center;color:#166534">${d.conf}</td><td style="padding:6px 12px;text-align:center"><div style="background:#f3f4f6;border-radius:3px;height:6px;overflow:hidden"><div style="background:${clr};height:100%;width:${pctS}%"></div></div></td></tr>`;
    }).join("");
    const dayRows=days.map(date=>{
      const mtgs=byDay[date];
      const rows=mtgs.map(m=>{
        const co=m.type==="company"?rsCoMap.get(m.companyId):null;
        const name=co?`${co.name}${co.ticker?" ("+co.ticker+")":""}`: (m.lsType||m.title||"Interno");
        const locStr=m.location==="ls_office"?(trip.officeAddress||"LS Offices"):m.location==="hq"?(co?co.hqAddress||co.name+" HQ":"HQ"):(m.locationCustom||"TBD");
        const hasPost=m.postNotes?`<div style="color:#166534;font-size:9pt;margin-top:2px">✅ ${m.postNotes.slice(0,100)}${m.postNotes.length>100?"…":""}</div>`:"";
        // Who actually went
        const allC=co?.contacts||[];
        const actIds=m.actualAttendees;
        const actReps=actIds!=null?(actIds.length?allC.filter(c=>actIds.includes(c.id)).map(c=>c.name).join(", "):"Nadie marcado"):"";
        const statusBadge=m.status==="confirmed"?`<span style="background:#dcfce7;color:#166534;padding:2px 7px;border-radius:3px;font-size:8.5pt;font-weight:600">✓ Confirmed</span>`:`<span style="background:#fef9c3;color:#854d0e;padding:2px 7px;border-radius:3px;font-size:8.5pt">◌ Tentative</span>`;
        return `<tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:6px 10px;font-family:'IBM Plex Mono',monospace;font-size:9pt;color:#6b7280;white-space:nowrap">${fmtH(m.hour)}</td>
          <td style="padding:6px 10px"><div style="font-weight:600;color:#000039">${name}</div>${hasPost}${actReps?`<div style="font-size:9pt;color:#6b7280;margin-top:2px">👤 ${actReps}</div>`:""}</td>
          <td style="padding:6px 10px;font-size:9.5pt;color:#374151">${locStr}</td>
          <td style="padding:6px 10px">${statusBadge}</td>
        </tr>`;
      }).join("");
      return `<div style="margin-bottom:20px">
        <div style="background:#000039;color:#fff;padding:8px 14px;border-radius:6px 6px 0 0;font-family:'IBM Plex Mono',monospace;font-size:9pt;letter-spacing:.08em;text-transform:uppercase">${fmtDate(date)}</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e9eef5;border-top:none;border-radius:0 0 6px 6px;overflow:hidden">
          <colgroup><col width="60"><col><col width="200"><col width="110"></colgroup>
          ${rows}
        </table>
      </div>`;
    }).join("");
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resumen — ${fund}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{margin:15mm 18mm;size:A4}
body{font-family:'Segoe UI',Calibri,sans-serif;font-size:10.5pt;color:#111827;background:#fff;padding:20px 24px}
.hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;margin-bottom:20px;border-bottom:2.5px solid #000039}
.ls1{font-size:13pt;font-weight:800;color:#000039;letter-spacing:.12em;text-transform:uppercase}
.ls2{font-size:6.5pt;color:#6b7280;letter-spacing:.2em;text-transform:uppercase;margin-top:2px}
.kpi-row{display:flex;gap:12px;margin-bottom:20px}
.kpi{flex:1;padding:14px 16px;border:1px solid #e9eef5;border-radius:8px;background:#f9fafb;text-align:center}
.kpi-num{font-family:'Georgia',serif;font-size:26pt;font-weight:700;color:#000039;line-height:1}
.kpi-lbl{font-size:8pt;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;margin-top:4px;font-family:'IBM Plex Mono',monospace}
.sec-title{font-size:10pt;font-weight:700;color:#000039;margin-bottom:10px;text-transform:uppercase;letter-spacing:.08em;padding-bottom:4px;border-bottom:2px solid #e9eef5}
table.sec-tbl{width:100%;border-collapse:collapse;border:1px solid #e9eef5;border-radius:6px;overflow:hidden;margin-bottom:20px}
table.sec-tbl th{background:#f3f4f6;padding:6px 12px;text-align:left;font-size:8.5pt;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;font-weight:600;border-bottom:1px solid #e9eef5}
.footer{margin-top:20px;padding-top:8px;border-top:1px solid #e9eef5;display:flex;justify-content:space-between;font-size:7.5pt;color:#9ca3af}
@media print{body{padding:0}.kpi{break-inside:avoid}}
</style></head><body>
<div class="hdr">
  <div><div class="ls1">Latin Securities</div><div class="ls2">Roadshow · Post-Trip Summary</div></div>
  <div style="text-align:right;font-size:9pt;color:#6b7280">
    <div style="font-weight:700;color:#000039;font-size:11pt">${fund}</div>
    <div>${trip.arrivalDate?new Date(trip.arrivalDate+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"long"}):""}${trip.departureDate?" – "+new Date(trip.departureDate+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"}):""}</div>
    <div>${visitorLine}</div>
  </div>
</div>

<div class="kpi-row">
  <div class="kpi"><div class="kpi-num">${allMtgs.length}</div><div class="kpi-lbl">Total Meetings</div></div>
  <div class="kpi"><div class="kpi-num" style="color:#166534">${conf.length}</div><div class="kpi-lbl">Confirmed</div></div>
  <div class="kpi"><div class="kpi-num" style="color:#854d0e">${tent.length}</div><div class="kpi-lbl">Tentative</div></div>
  <div class="kpi"><div class="kpi-num">${pct}%</div><div class="kpi-lbl">Conf. Rate</div></div>
  <div class="kpi"><div class="kpi-num">${days.length}</div><div class="kpi-lbl">Days</div></div>
</div>

<div class="sec-title">Coverage by Sector</div>
<table class="sec-tbl">
  <tr><th>Sector</th><th style="text-align:center">Total</th><th style="text-align:center">Confirmed</th><th>% Confirmed</th></tr>
  ${sectorRows}
</table>

<div class="sec-title">Meeting Schedule</div>
${dayRows}

${days.some(d=>byDay[d].some(m=>m.postNotes))?`
<div class="sec-title">Post-Meeting Notes</div>
${days.flatMap(d=>byDay[d].filter(m=>m.postNotes).map(m=>{
  const co=m.type==="company"?rsCoMap.get(m.companyId):null;
  return `<div style="margin-bottom:12px;padding:10px 14px;border-left:3px solid #166534;background:#f0fdf4;border-radius:0 6px 6px 0">
    <div style="font-weight:600;color:#000039;margin-bottom:4px">${co?co.name:(m.lsType||m.title||"Interno")} · ${fmtDate(m.date)} ${fmtH(m.hour)}</div>
    <div style="font-size:10pt;color:#166534;line-height:1.6">${m.postNotes}</div>
  </div>`;
})).join("")}`:""}

<div class="footer"><span>Latin Securities · Confidential</span><span>${fund} · Post-Trip Summary</span></div>
</body></html>`;
    openPrint(html);
  }
  function exportCompanyBrief(co){
    // Build a meeting brief one-pager for a roadshow company
    const mtg=(roadshow.meetings||[]).find(m=>m.type==="company"&&m.companyId===co.id);
    const trip=roadshow.trip;
    const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
    const locStr=!mtg?"TBD":mtg.location==="ls_office"?(trip.officeAddress||"Arenales 707, 6° Piso, CABA"):mtg.location==="hq"?(co.hqAddress||co.name+" HQ"):(mtg.locationCustom||"TBD");
    const dateStr=mtg?new Date(mtg.date+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"Sin fecha";
    const contacts=(co.contacts||[]).filter(c=>c.name);
    const selIds=mtg?.attendeeIds||[];
    const mtgContacts=selIds.length?contacts.filter(c=>selIds.includes(c.id)):contacts;
    const visitorLine=(trip.visitors||[]).filter(v=>v.name).map(v=>v.name+(v.title?" – "+v.title:"")).join(" · ") || trip.clientName||"";
    // logo_b64 intentionally unused — brief uses text wordmark
    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Brief – ${co.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{margin:18mm 20mm;size:A4}
body{font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:11pt;color:#111827;background:#fff;padding:24px 28px}
.hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;margin-bottom:20px;border-bottom:2.5px solid #000039}
.ls-wm1{font-size:13pt;font-weight:800;color:#000039;letter-spacing:.12em;text-transform:uppercase}
.ls-wm2{font-size:6.5pt;color:#6b7280;letter-spacing:.2em;text-transform:uppercase;margin-top:2px}
.co-header{margin-bottom:20px}
.co-name{font-size:22pt;font-weight:700;color:#000039;font-family:'Georgia',serif;line-height:1.15}
.co-meta{display:flex;gap:14px;margin-top:6px;flex-wrap:wrap}
.badge{font-size:9pt;padding:3px 10px;border-radius:20px;font-weight:600;background:#f0f4ff;color:#1e5ab0;border:1px solid #c7d7f7}
.section{margin-bottom:18px;padding:14px 16px;border-radius:8px;border:1px solid #e9eef5;background:#f9fafb}
.sec-label{font-size:8.5pt;text-transform:uppercase;letter-spacing:.15em;color:#9ca3af;font-weight:700;margin-bottom:8px}
.meeting-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin-bottom:18px}
.meet-row{display:flex;gap:8px;margin-bottom:5px;font-size:10.5pt}
.meet-label{color:#6b7280;min-width:80px;font-size:9.5pt}
.contact-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6;font-size:10pt}
.contact-row:last-child{border-bottom:none}
.notes-box{background:#fff;border:1px solid #e9eef5;border-radius:6px;padding:12px;min-height:60px;font-size:10pt;color:#374151;line-height:1.6;white-space:pre-wrap}
.post-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;min-height:60px;font-size:10pt;color:#166534;line-height:1.6;white-space:pre-wrap}
.footer{margin-top:24px;padding-top:10px;border-top:1px solid #e9eef5;display:flex;justify-content:space-between;font-size:8pt;color:#9ca3af}
@media print{body{padding:0}.section,.meeting-box{break-inside:avoid}}
</style></head><body>
<div class="hdr">
  <div><div class="ls-wm1">Latin Securities</div><div class="ls-wm2">Investment Banking · Buenos Aires</div></div>
  <div style="text-align:right;font-size:9pt;color:#6b7280">${trip.fund||trip.clientName||"Roadshow"}<br/>${dateStr}</div>
</div>
<div class="co-header">
  <div class="co-name">${co.name}</div>
  <div class="co-meta">
    ${co.ticker?`<span class="badge">${co.ticker}</span>`:""}
    ${co.sector?`<span class="badge" style="background:#f9fafb;color:#374151;border-color:#e5e7eb">${co.sector}</span>`:""}
    ${mtg?.status==="confirmed"?`<span class="badge" style="background:#dcfce7;color:#166534;border-color:#86efac">✓ Confirmed</span>`:
      mtg?.status==="tentative"?`<span class="badge" style="background:#fef9c3;color:#854d0e;border-color:#fde68a">◌ Tentative</span>`:""}
  </div>
</div>
<div class="meeting-box">
  <div class="sec-label">Meeting Details</div>
  <div class="meet-row"><span class="meet-label">📅 Date</span><strong>${dateStr}</strong></div>
  ${mtg?`<div class="meet-row"><span class="meet-label">⏰ Time</span><strong>${fmtH(mtg.hour)} – ${fmtH(mtg.hour+(trip.meetingDuration||60)/60)} (${trip.meetingDuration||60} min)</strong></div>`:""}
  <div class="meet-row"><span class="meet-label">📍 Location</span>${locStr}</div>
  ${visitorLine?`<div class="meet-row"><span class="meet-label">👤 Investor</span>${visitorLine}</div>`:""}
  ${mtg?.meetingFormat&&mtg.meetingFormat!=="Meeting"?`<div class="meet-row"><span class="meet-label">🍽 Format</span>${mtg.meetingFormat}</div>`:""}
</div>
${mtgContacts.length?`
<div class="section">
  <div class="sec-label">Company Representatives</div>
  ${mtgContacts.map(c=>`<div class="contact-row"><span style="font-weight:600">${c.name}</span><span style="color:#6b7280">${c.title||""}</span><span style="color:#374151;font-size:9.5pt">${c.email||""}</span></div>`).join("")}
</div>`:""}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px">
  <div>
    <div class="sec-label" style="margin-bottom:6px">📋 Pre-meeting notes</div>
    <div class="notes-box">${(mtg?.notes||co.notes||"—").replace(/</g,"&lt;")}</div>
  </div>
  <div>
    <div class="sec-label" style="margin-bottom:6px">✅ Post-meeting notes</div>
    <div class="post-box">${(mtg?.postNotes||"").replace(/</g,"&lt;")||"<span style='color:#9ca3af;font-style:italic'>Complete after the meeting</span>"}</div>
  </div>
</div>
${co.hqAddress?`<div class="section"><div class="sec-label">Company Address</div><div style="font-size:10.5pt">${co.hqAddress}</div></div>`:""}
<div class="footer"><span>Latin Securities · Confidential</span><span>${co.name} · ${trip.fund||trip.clientName||""}</span></div>
</body></html>`;
    openPrint(html);
  }
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

        const rsCoMap=new Map((roadshow.companies||[]).map(c=>[c.name.toLowerCase(),c]));
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
  // ── Supabase auth + cloud sync ───────────────────────────────
  useEffect(()=>{
    // Safety timeout: if Supabase doesn't respond in 8s (e.g. paused project), show login
    const safetyTimer = setTimeout(()=>setAuthLoading(false), 8000);
    supabase.auth.getSession().then(({data:{session}})=>{
      clearTimeout(safetyTimer);
      setAuthUser(session?.user||null);
      if(session?.user) loadFromCloud(session.user.id);
      else setAuthLoading(false);
    }).catch(()=>{ clearTimeout(safetyTimer); setAuthLoading(false); });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>{
      setAuthUser(session?.user||null);
      if(session?.user) loadFromCloud(session.user.id);
      else setAuthLoading(false);
    });
    return()=>{ clearTimeout(safetyTimer); subscription.unsubscribe(); };
  },[]);// eslint-disable-line

  async function loadFromCloud(userId){
    // Load events
    const{data:evRows}=await supabase.from("ls_events").select("id,name,kind,data").eq("user_id",userId);
    if(evRows?.length){
      const cloudEvs=evRows.map(r=>({id:r.id,name:r.name,kind:r.kind,...r.data}));
      setEvents(cloudEvs); saveEvents(cloudEvs);
      setActiveEv(prev=>cloudEvs.find(e=>e.id===prev)?prev:cloudEvs[0]?.id||null);
    } else {
      // First login: migrate localStorage events to cloud
      const local=loadEvents();
      if(local.length){
        for(const ev of local){
          const{id,name,kind,...data}=ev;
          await supabase.from("ls_events").upsert({id,name,kind,data,user_id:userId});
        }
      }
    }
    // Load library
    const{data:dbRow}=await supabase.from("ls_global_db").select("data").eq("user_id",userId).single();
    if(dbRow?.data){setGlobalDB(dbRow.data);saveDB(dbRow.data);}
    setAuthLoading(false);
  }

  async function cloudSaveEvent(ev){
    if(!authUser) return;
    const{id,name,kind,...data}=ev;
    await supabase.from("ls_events").upsert({id,name,kind,data,user_id:authUser.id});
  }
  async function cloudDeleteEvent(evId){
    if(!authUser) return;
    await supabase.from("ls_events").delete().eq("id",evId).eq("user_id",authUser.id);
  }
  async function cloudSaveGlobalDB(db){
    if(!authUser) return;
    await supabase.from("ls_global_db").upsert({user_id:authUser.id,data:db});
  }

  async function signIn(){
    setAuthBusy(true);setAuthErr("");
    const{error}=await supabase.auth.signInWithPassword({email:authEmail,password:authPwd});
    if(error) setAuthErr(error.message);
    setAuthBusy(false);
  }
  async function signUp(){
    setAuthBusy(true);setAuthErr("");
    const{error}=await supabase.auth.signUp({email:authEmail,password:authPwd,options:{data:{display_name:authName}}});
    if(error) setAuthErr(error.message);
    else setAuthErr("✅ Revisá tu email para confirmar la cuenta, luego iniciá sesión.");
    setAuthBusy(false);
  }
  async function signOut(){
    await supabase.auth.signOut();
    setAuthUser(null);setAuthLoading(false);
  }

  // ── Wrap saveEvents to also sync to cloud ───────────────────
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
  const rsCoById=useMemo(()=>new Map((roadshow.companies||[]).map(c=>[c.id,c])),[roadshow.companies]);
  const rsBySlot=useMemo(()=>{const m={};(roadshow.meetings||[]).forEach(mt=>{m[`${mt.date}-${mt.hour}`]=mt;});return m;},[roadshow.meetings]);
  const rsOverlapSet=useMemo(()=>{
    const s=new Set(); const byDay={};
    (roadshow.meetings||[]).filter(m=>m.status!=="cancelled").forEach(m=>{if(!byDay[m.date])byDay[m.date]=[];byDay[m.date].push(m);});
    Object.values(byDay).forEach(ms=>{
      ms.sort((a,b)=>a.hour-b.hour);
      for(let i=0;i<ms.length-1;i++){if(ms[i].hour+(ms[i].duration||60)/60>ms[i+1].hour){s.add(ms[i].id);s.add(ms[i+1].id);}}
    });
    return s;
  },[roadshow.meetings]);
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

  const CONF_TAB_IDS=["upload","investors","companies","schedule","feedback","export","historical"];
  useEffect(()=>{
    const ev=events.find(e=>e.id===activeEv);
    setRoadshow(ev?.roadshow||{trip:RS_TRIP_DEF,companies:RS_COS_DEF,meetings:[]});
    setOutbound(ev?.outbound||OB_DEF);
    // Jump to correct default tab for this event kind
    if(ev?.kind==="roadshow") setTab(t=>CONF_TAB_IDS.includes(t)||t==="config"?"roadshow":t==="outbound"?"roadshow":t);
    else if(ev?.kind==="outbound") setTab(t=>CONF_TAB_IDS.includes(t)||t==="roadshow"||t==="config"?"outbound":t);
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
    {id:"feedback",label:`📊 Feedback${meetings.filter(m=>m.feedback?.interestLevel).length>0?" ("+meetings.filter(m=>m.feedback?.interestLevel).length+")":""}`},
    {id:"export",label:"⬇ Exportar"},
    {id:"historical",label:"📊 Histórico"},
    {id:"activitylog",label:"🕐 Historial"},
    DB_TAB,
  ];
  const RS_TABS=[
    {id:"roadshow",label:"🗺️ Inbound"},
    {id:"activitylog",label:"🕐 Historial"},
    DB_TAB,
  ];
  const OUT_TABS=[
    {id:"outbound",label:"✈️ Outbound"},
    {id:"activitylog",label:"🕐 Historial"},
    DB_TAB,
  ];
  const TABS=evKind==="roadshow"?RS_TABS:evKind==="outbound"?OUT_TABS:CONF_TABS;

  // ── Auth loading screen ─────────────────────────────────────
  // ── Dashboard helpers ────────────────────────────────────────
  const dashEvents=useMemo(()=>events.map(ev=>{
    const mtgs=ev.roadshow?.meetings||ev.meetings||[];
    const conf=mtgs.filter(m=>m.status==="confirmed").length;
    const tent=mtgs.filter(m=>m.status==="tentative").length;
    const invs=(ev.investors||[]).length;
    const fund=ev.roadshow?.trip?.fund||ev.roadshow?.trip?.clientName||"";
    const dateFrom=ev.roadshow?.trip?.arrivalDate||ev.outbound?.destinations?.[0]?.dateFrom||"";
    const dateTo=ev.roadshow?.trip?.departureDate||ev.outbound?.destinations?.at(-1)?.dateTo||"";
    const fmtD=iso=>{try{return new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"short"});}catch{return iso;}};
    const dates=dateFrom?`${fmtD(dateFrom)}${dateTo&&dateTo!==dateFrom?" – "+fmtD(dateTo):""}`:""
    const now=new Date();
    const start=dateFrom?new Date(dateFrom+"T12:00:00"):null;
    const end=dateTo?new Date(dateTo+"T12:00:00"):null;
    const state=!start?"draft":now<start?"upcoming":end&&now>end?"past":"active";
    return{...ev,conf,tent,invs,fund,dates,state};
  }),[events]);
  const hasEvents=events.length>0;

  if(authLoading) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0d0e1a",flexDirection:"column",gap:16}}>
      <div style={{width:36,height:36,border:"3px solid #1e5ab0",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
      <div style={{color:"#7a8fa8",fontSize:12,fontFamily:"IBM Plex Mono,monospace"}}>Cargando...</div>
    </div>
  );

  // ── Auth gate ────────────────────────────────────────────────
  if(!authUser) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0d0e1a",padding:20}}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}.auth-inp{width:100%;padding:10px 13px;background:rgba(30,90,176,.08);border:1.5px solid rgba(30,90,176,.25);border-radius:7px;color:#e8eaf0;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:10px}.auth-inp:focus{border-color:#3399ff}.auth-btn{width:100%;padding:12px;background:#1e5ab0;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer}.auth-btn:disabled{opacity:.5;cursor:not-allowed}"}</style>
      <div style={{width:"100%",maxWidth:380,background:"rgba(20,22,40,.98)",border:"1px solid rgba(30,90,176,.2)",borderRadius:16,padding:"36px 32px",boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontFamily:"Playfair Display,serif",fontSize:26,color:"#e8eaf0",marginBottom:4}}>Latin Securities</div>
          <div style={{color:"#7a8fa8",fontSize:11,fontFamily:"IBM Plex Mono,monospace",letterSpacing:".12em",textTransform:"uppercase"}}>LS Event Manager</div>
        </div>
        <div style={{display:"flex",gap:4,marginBottom:24,background:"rgba(30,90,176,.08)",borderRadius:8,padding:3}}>
          {[["login","Iniciar sesión"],["signup","Crear cuenta"]].map(([v,l])=>(
            <button key={v} onClick={()=>{setAuthView(v);setAuthErr("");}}
              style={{flex:1,padding:"8px 0",border:"none",borderRadius:6,cursor:"pointer",fontSize:12,fontWeight:700,transition:"all .15s",
                background:authView===v?"#1e5ab0":"transparent",color:authView===v?"#fff":"#7a8fa8"}}>
              {l}
            </button>
          ))}
        </div>
        {authView==="signup"&&<input className="auth-inp" placeholder="Nombre completo" value={authName} onChange={e=>setAuthName(e.target.value)}/>}
        <input className="auth-inp" type="email" placeholder="Email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(authView==="login"?signIn():signUp())}/>
        <input className="auth-inp" type="password" placeholder="Contraseña" value={authPwd} onChange={e=>setAuthPwd(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(authView==="login"?signIn():signUp())}/>
        {authErr&&<div style={{fontSize:12,color:authErr.startsWith("✅")?"#3a8c5c":"#e05050",marginBottom:12,lineHeight:1.5,padding:"8px 10px",background:authErr.startsWith("✅")?"rgba(58,140,92,.1)":"rgba(214,68,68,.08)",borderRadius:6}}>{authErr}</div>}
        <button className="auth-btn" disabled={authBusy||!authEmail||!authPwd} onClick={authView==="login"?signIn:signUp}>
          {authBusy?"⏳ Procesando...":(authView==="login"?"Entrar":"Crear cuenta")}
        </button>
        <div style={{textAlign:"center",marginTop:16,fontSize:11,color:"rgba(120,140,170,.5)",fontFamily:"IBM Plex Mono,monospace"}}>
          Tus datos están cifrados y sincronizados en la nube.
        </div>
      </div>
    </div>
  );

  if(!currentEvent||dashboardView) return(
    <DashboardView
      events={events} dashEvents={dashEvents} setEvents={setEvents} saveEvents={saveEvents}
      activeEv={activeEv} setActiveEv={setActiveEv} config={config}
      authUser={authUser} authView={authView} setAuthView={setAuthView}
      authEmail={authEmail} setAuthEmail={setAuthEmail}
      authPwd={authPwd} setAuthPwd={setAuthPwd}
      authName={authName} setAuthName={setAuthName}
      authErr={authErr} setAuthErr={setAuthErr} authBusy={authBusy}
      signIn={signIn} signUp={signUp} signOut={signOut}
      dashboardView={dashboardView} setDashboardView={setDashboardView}
      showEvMgr={showEvMgr} setShowEvMgr={setShowEvMgr}
      showSearch={showSearch} setShowSearch={setShowSearch}
      globalSearch={globalSearch} setGlobalSearch={setGlobalSearch}
      searchFilter={searchFilter} setSearchFilter={setSearchFilter}
      searchStatus={searchStatus} setSearchStatus={setSearchStatus}
      evPasswordModal={evPasswordModal} setEvPasswordModal={setEvPasswordModal}
      evPasswordInput={evPasswordInput} setEvPasswordInput={setEvPasswordInput}
      newEvKind={newEvKind} setNewEvKind={setNewEvKind}
      newEvName={newEvName} setNewEvName={setNewEvName}
      kioskMode={kioskMode} setKioskMode={setKioskMode}
      kioskIdx={kioskIdx} setKioskIdx={setKioskIdx}
      setKioskFb={setKioskFb} setRsDayFilter={setRsDayFilter}
      setTab={setTab} setRsSubTab={setRsSubTab}
    />
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
        <h1 style={{cursor:"pointer"}} onClick={()=>setDashboardView(v=>!v)} title="Dashboard">🏠 LS Event Manager</h1>
        <p>Latin Securities · Roadshow/Event Manager</p>
      </div>
      {/* Event switcher */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginRight:16,padding:"0 12px",borderRight:"1px solid rgba(255,255,255,.07)"}}>
        <button style={{fontSize:10,color:"var(--dim)",background:"none",border:"1px solid rgba(30,90,176,.15)",borderRadius:5,padding:"3px 9px",cursor:"pointer",fontFamily:"IBM Plex Mono,monospace",letterSpacing:".04em"}} onClick={()=>setDashboardView(true)} title="Volver al dashboard">← Dashboard</button>
        <span style={{fontSize:10,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".06em"}}>Evento:</span>
        <select className="sel" style={{width:"auto",fontSize:11,padding:"4px 8px"}} value={activeEv||""}
          onChange={e=>{setActiveEv(e.target.value);setTab("schedule");}}>
          {events.filter(e=>!e.archived||e.id===activeEv).map(e=><option key={e.id} value={e.id}>{e.archived?"🗄 ":e.kind==="roadshow"?"🗺️ ":e.kind==="outbound"?"✈️ ":"🏛 "}{e.name}</option>)}
        </select>
        <button className="btn bo bs" style={{fontSize:9}} onClick={()=>setShowEvMgr(true)}>＋ Nuevo</button>
        <button className="btn bo bs" style={{fontSize:9}} title="Búsqueda global" onClick={()=>{setSearchFilter("all");setSearchStatus("all");setShowSearch(true);}}>🔍</button>
        {evKind==="roadshow"&&(()=>{
          const _today=new Date().toISOString().slice(0,10);
          const _todayCount=(roadshow.meetings||[]).filter(m=>m.date===_today&&m.status!=="cancelled").length;
          return(
            <button className="btn bo bs" style={{fontSize:9,borderColor:"rgba(30,90,176,.3)",position:"relative"}} title="Modo día — vista simplificada para celular"
              onClick={()=>{
                const targetDate=_todayCount>0?_today:(tripDays.find(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;})||tripDays[0]);
                if(!targetDate){alert("Configurá las fechas del viaje primero.");return;}
                setRsDayFilter(targetDate);setKioskIdx(0);setKioskFb(false);setKioskMode(true);
              }}>
              📱{_todayCount>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#e8850a",color:"#fff",borderRadius:"50%",width:13,height:13,fontSize:7,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"IBM Plex Mono,monospace",fontWeight:700,lineHeight:1}}>{_todayCount}</span>}
            </button>
          );
        })()}
        <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 8px",background:"rgba(30,90,176,.08)",borderRadius:6}}>
          <span style={{fontSize:9,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>☁ {authUser?.email}</span>
          <button className="btn bo bs" style={{fontSize:9,padding:"2px 6px"}} onClick={signOut}>Salir</button>
        </div>
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
                    <div style={{fontSize:10,color:"var(--dim)",marginTop:2}}>
                      {(e.investors||[]).length} inversores · {(e.meetings||e.roadshow?.meetings||[]).length} reuniones
                      {(e.activityLog||[]).length>0&&<span style={{marginLeft:6,color:"rgba(30,90,176,.4)"}}>· {(e.activityLog||[]).length} cambios</span>}
                    </div>
                  </div>
                  <button className="btn bo bs" onClick={()=>handleOpenEvent(e.id)}>Abrir</button>
                  <button className="btn bo bs" title="Duplicar (copia sin reuniones)" onClick={()=>duplicateEvent(e.id)}>⧉ Duplicar</button>
                  <button className="btn bo bs" title={e.passwordHash?"Cambiar contraseña":"Poner contraseña"} onClick={()=>{
                    setEvPasswordModal({evId:e.id,mode:"set"});setEvPasswordInput("");
                  }}>{e.passwordHash?"🔒":"🔓"}</button>
                  {events.length>1&&<button className="btn bd bs" title="Eliminar evento" onClick={()=>{
                    if(confirm(`Eliminar "${e.name}"? Esta acción no se puede deshacer.`)){
                      const next=events.filter(x=>x.id!==e.id);setEvents(next);saveEvents(next);cloudDeleteEvent(e.id);
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

    {/* ── Password modal ── */}
    {evPasswordModal&&(
      <div className="overlay" onClick={e=>{if(e.target===e.currentTarget){setEvPasswordModal(null);evPasswordModal.resolve&&evPasswordModal.resolve(false);}}}>
        <div className="modal" style={{maxWidth:360}}>
          <div className="modal-hdr">
            <div className="modal-title">{evPasswordModal.mode==="check"?"🔒 Evento protegido":"🔒 Contraseña del evento"}</div>
          </div>
          <div className="modal-body">
            {evPasswordModal.mode==="check"?(
              <>
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:12}}>Este evento está protegido. Ingresá la contraseña para abrirlo.</p>
                <div className="lbl">Contraseña</div>
                <input className="inp" type="password" autoFocus value={evPasswordInput} onChange={e=>setEvPasswordInput(e.target.value)}
                  placeholder="Contraseña..."
                  onKeyDown={async e=>{if(e.key==="Enter"){const hash=await hashPwd(evPasswordInput);const ev=events.find(x=>x.id===evPasswordModal.evId);const ok=ev?.passwordHash===hash;setEvPasswordModal(null);evPasswordModal.resolve(ok);if(!ok)alert("Contraseña incorrecta.");}}}/>
              </>
            ):(
              <>
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:12}}>Ingresá una contraseña para proteger este evento. Dejá vacío para quitar la contraseña.</p>
                <div className="lbl">Nueva contraseña</div>
                <input className="inp" type="password" autoFocus value={evPasswordInput} onChange={e=>setEvPasswordInput(e.target.value)} placeholder="Dejar vacío para quitar..."/>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn bo bs" onClick={()=>{setEvPasswordModal(null);evPasswordModal.resolve&&evPasswordModal.resolve(false);}}>Cancelar</button>
            {evPasswordModal.mode==="check"?(
              <button className="btn bg bs" onClick={async()=>{const hash=await hashPwd(evPasswordInput);const ev=events.find(x=>x.id===evPasswordModal.evId);const ok=ev?.passwordHash===hash;setEvPasswordModal(null);evPasswordModal.resolve(ok);if(!ok)alert("Contraseña incorrecta.");}}>Abrir</button>
            ):(
              <button className="btn bg bs" onClick={()=>{setEvPassword(evPasswordModal.evId,evPasswordInput);setEvPasswordModal(null);}}>Guardar</button>
            )}
          </div>
        </div>
      </div>
    )}

    {/* ── Global Search Modal ── */}
    {showSearch&&(
      <div className="overlay" onClick={e=>{if(e.target===e.currentTarget){setShowSearch(false);setGlobalSearch("");setSearchFilter("all");setSearchStatus("all");}}}>
        <div className="modal" style={{maxWidth:540}}>
          <div className="modal-hdr"><div className="modal-title">🔍 Búsqueda global</div></div>
          <div className="modal-body" style={{padding:"12px 20px"}}>
            <input className="inp" autoFocus value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)}
              placeholder="Empresa, inversor, reunión, ticker..." style={{marginBottom:8,fontSize:13}}/>
            {/* Filter chips */}
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
              {[["all","Todos"],["meeting","📅 Reuniones"],["company","🏢 Empresas"],["investor","👤 Inversores"],["db","📚 Librería"]].map(([v,l])=>(
                <button key={v} onClick={()=>setSearchFilter(v)}
                  style={{padding:"2px 9px",borderRadius:20,border:`1px solid ${searchFilter===v?"#1e5ab0":"rgba(30,90,176,.15)"}`,
                    background:searchFilter===v?"rgba(30,90,176,.1)":"transparent",
                    color:searchFilter===v?"#1e5ab0":"var(--dim)",fontSize:10,cursor:"pointer",fontWeight:searchFilter===v?600:400}}>
                  {l}
                </button>
              ))}
              {(searchFilter==="all"||searchFilter==="meeting")&&<>
                <div style={{width:1,background:"rgba(30,90,176,.1)",margin:"0 2px"}}/>
                {[["all","Todos estados"],["confirmed","✅ Confirmadas"],["tentative","◌ Tentativas"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setSearchStatus(v)}
                    style={{padding:"2px 9px",borderRadius:20,border:`1px solid ${searchStatus===v?"#166534":"rgba(30,90,176,.1)"}`,
                      background:searchStatus===v?"rgba(22,101,52,.08)":"transparent",
                      color:searchStatus===v?"#166534":"var(--dim)",fontSize:10,cursor:"pointer",fontWeight:searchStatus===v?600:400}}>
                    {l}
                  </button>
                ))}
              </>}
            </div>
            {(()=>{
              const q=(globalSearch||"").toLowerCase().trim();
              if(!q) return <div style={{color:"var(--dim)",fontSize:12,textAlign:"center",padding:"20px 0"}}>Escribí para buscar en reuniones, empresas e inversores</div>;
              const results=[];
              // Search meetings in current event
              if(searchFilter==="all"||searchFilter==="meeting"){
                (roadshow.meetings||[]).filter(m=>{
                  if(searchStatus==="confirmed"&&m.status!=="confirmed") return false;
                  if(searchStatus==="tentative"&&m.status!=="tentative") return false;
                  return true;
                }).forEach(m=>{
                  const co=m.type==="company"?rsCoById.get(m.companyId):null;
                  const txt=[co?.name,co?.ticker,m.lsType,m.title,m.participants,m.notes,m.postNotes].filter(Boolean).join(" ").toLowerCase();
                  if(!txt.includes(q)) return;
                  const statusTag=m.status==="confirmed"?"✅":"◌";
                  results.push({type:"meeting",icon:"📅",title:co?.name||(m.lsType||m.title||"Reunión"),sub:`${m.date} · ${fmtHour(m.hour)} · ${statusTag} ${m.status==="confirmed"?"Confirmada":"Tentativa"}`,onClick:()=>{setRsMtgModal({date:m.date,hour:m.hour,meeting:m});setRsSubTab("schedule");setShowSearch(false);}});
                });
              }
              // Search roadshow companies
              if(searchFilter==="all"||searchFilter==="company"){
                (roadshow.companies||[]).forEach(co=>{
                  const txt=[co.name,co.ticker,co.sector,co.hqAddress,...(co.contacts||[]).map(c=>c.name+c.title)].join(" ").toLowerCase();
                  if(txt.includes(q)) results.push({type:"company",icon:"🏢",title:`${co.name}${co.ticker?" ("+co.ticker+")":""}`,sub:co.sector+(co.hqAddress?" · "+co.hqAddress:""),onClick:()=>{setRsSubTab("companies");setShowSearch(false);}});
                });
              }
              // Search library
              if(searchFilter==="all"||searchFilter==="db"){
                (globalDB.companies||[]).forEach(co=>{
                  const txt=[co.name,co.ticker,co.sector,...(co.contacts||[]).map(c=>c.name)].join(" ").toLowerCase();
                  if(txt.includes(q)) results.push({type:"db",icon:"📚",title:`${co.name}${co.ticker?" ("+co.ticker+")":""}`,sub:"Librería · "+co.sector,onClick:()=>{setTab("db");setDbTab("companies");setShowSearch(false);}});
                });
              }
              (globalDB.investors||[]).forEach(inv=>{
                const txt=[inv.name,inv.fund,inv.position,inv.notes].filter(Boolean).join(" ").toLowerCase();
                if(txt.includes(q)) results.push({type:"investor",icon:"👤",title:inv.name,sub:(inv.fund||"")+(inv.position?" · "+inv.position:""),onClick:()=>{setTab("db");setDbTab("investors");setShowSearch(false);}});
              });
              if(!results.length) return <div style={{color:"var(--dim)",fontSize:12,textAlign:"center",padding:"20px 0"}}>Sin resultados para "{q}"</div>;
              return(
                <div style={{maxHeight:320,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                  <div style={{fontSize:10,color:"var(--dim)",marginBottom:4}}>{results.length} resultado(s)</div>
                  {results.slice(0,20).map((r,i)=>(
                    <div key={i} onClick={r.onClick} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:7,cursor:"pointer",background:"rgba(30,90,176,.04)",border:"1px solid rgba(30,90,176,.08)",transition:"all .12s"}}
                      onMouseEnter={e=>{e.currentTarget.style.background="rgba(30,90,176,.1)";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="rgba(30,90,176,.04)";}}>
                      <span style={{fontSize:18}}>{r.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--cream)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.title}</div>
                        <div style={{fontSize:10,color:"var(--dim)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.sub}</div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          <div className="modal-footer"><button className="btn bo bs" onClick={()=>{setShowSearch(false);setGlobalSearch("");}}>Cerrar</button></div>
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

      {/* ════ FEEDBACK ════ */}
      {tab==="feedback"&&(()=>{
        const INTEREST_LABELS=["","💤 Sin interés","😐 Bajo","👍 Medio","😃 Interesado","🔥 Muy interesado"];
        const INTEREST_COLORS=["","#dc2626","#ea580c","#ca8a04","#16a34a","#166534"];
        const withFb=meetings.filter(m=>m.feedback?.interestLevel);
        const invByIdFb=new Map(investors.map(i=>[i.id,i]));
        const coByIdFb=new Map(companies.map(c=>[c.id,c]));
        const byLevel={};withFb.forEach(m=>{const l=m.feedback?.interestLevel||0;byLevel[l]=(byLevel[l]||0)+1;});
        const avgInterest=withFb.length?Math.round(withFb.reduce((s,m)=>s+(m.feedback?.interestLevel||0),0)/withFb.length*10)/10:0;
        const NEXT_LABELS={"follow_up_call":"📞 Follow-up call","send_materials":"📄 Enviar materiales","meeting_again":"🔁 Repetir reunión","monitor":"👁 Monitorear","no_interest":"❌ Sin interés"};
        return(
          <div className="pg">
            <h2 className="pg-h" style={{marginBottom:4}}>📊 Feedback de reuniones</h2>
            <p className="pg-s" style={{marginBottom:16}}>Completar después de cada reunión. Generá el reporte interno en un click.</p>

            {/* Stats */}
            <div style={{display:"flex",gap:0,marginBottom:20,background:"#fff",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,57,.08)",border:"1px solid #e9eef5"}}>
              {[{lbl:"Total",val:meetings.length,clr:"#000039"},{lbl:"Con feedback",val:withFb.length,clr:"#1e5ab0"},{lbl:"Sin feedback",val:meetings.length-withFb.length,clr:"#9ca3af"},{lbl:"Interés prom.",val:avgInterest?"⭐ "+avgInterest+"/5":"—",clr:"#ca8a04"}].map(({lbl,val,clr})=>(
                <div key={lbl} style={{flex:1,padding:"14px 10px",borderRight:"1px solid #f0f3f8",textAlign:"center"}}>
                  <div style={{fontSize:20,fontWeight:700,color:clr,fontFamily:"Playfair Display,serif",lineHeight:1}}>{val}</div>
                  <div style={{fontSize:8,color:"#9ca3af",fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".08em",marginTop:4}}>{lbl}</div>
                </div>
              ))}
              {withFb.length>0&&(
                <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:6,borderLeft:"1px solid #f0f3f8"}}>
                  <button className="btn bg bs" style={{fontSize:10,whiteSpace:"nowrap"}} onClick={()=>{
                    const rows=withFb.map(m=>{const inv=(m.invIds||[]).map(id=>invByIdFb.get(id)).filter(Boolean);const co=coByIdFb.get(m.coId);const fb=m.feedback||{};return INTEREST_LABELS[fb.interestLevel||0]+" | "+inv.map(i=>i.name).join(", ")+" | "+inv.map(i=>i.fund).filter(Boolean).join(", ")+" | "+(co?.name||"")+" | "+(fb.topics||[]).join(", ")+" | "+(NEXT_LABELS[fb.nextStep||""]||"")+" | "+(fb.internalNotes||"");});
                    const txt="FEEDBACK — "+(currentEvent?.name||"Conferencia")+"\n"+"─".repeat(60)+"\n"+rows.join("\n")+"\n\nLatin Securities";





                    navigator.clipboard.writeText(txt).then(()=>alert("✅ Copiado")).catch(()=>{const w=window.open("","_blank","width=700,height=480");w.document.write("<pre style='font:12px monospace;padding:20px;white-space:pre-wrap'>"+txt+"</pre>");w.document.close();});
                  }}>📋 Copiar WhatsApp</button>
                  <button className="btn bo bs" style={{fontSize:10,whiteSpace:"nowrap"}} onClick={()=>{
                    const rows=withFb.map(m=>{const inv=(m.invIds||[]).map(id=>invByIdFb.get(id)).filter(Boolean);const co=coByIdFb.get(m.coId);const fb=m.feedback||{};return`<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:8px 12px;font-size:20px">${["","💤","😐","👍","😃","🔥"][fb.interestLevel||0]}</td><td style="padding:8px 12px"><b style="color:#000039">${inv.map(i=>i.name).join(", ")}</b><br><small style="color:#6b7280">${inv.map(i=>i.fund).filter(Boolean).join(", ")}</small></td><td style="padding:8px 12px;color:#1e5ab0;font-weight:600">${co?.ticker||""}</td><td style="padding:8px 12px">${(fb.topics||[]).map(t=>`<span style="background:#f0f4ff;padding:1px 7px;border-radius:10px;margin:1px;display:inline-block;font-size:10px">${t}</span>`).join("")}</td><td style="padding:8px 12px;font-size:11px">${NEXT_LABELS[fb.nextStep||""]||""}</td><td style="padding:8px 12px;font-size:11px;color:#6b7280">${fb.internalNotes||""}</td></tr>`;}).join("");
                    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Feedback</title><style>body{font-family:Segoe UI,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th{background:#000039;color:#fff;padding:7px 12px;text-align:left;font-size:10px;text-transform:uppercase}</style></head><body><div style="display:flex;justify-content:space-between;padding-bottom:12px;margin-bottom:16px;border-bottom:2.5px solid #000039"><div style="font-size:14px;font-weight:800;color:#000039;letter-spacing:.12em;text-transform:uppercase">LATIN SECURITIES<br><span style="font-size:9px;color:#9ca3af;font-weight:400;letter-spacing:.18em">FEEDBACK REPORT</span></div><div style="text-align:right;font-size:11px;color:#6b7280">${currentEvent?.name||""}<br>${new Date().toLocaleDateString("es-AR")}</div></div><table><tr><th></th><th>Inversor</th><th>Co.</th><th>Temas</th><th>Próximo paso</th><th>Notas</th></tr>${rows}</table></body></html>`;
                    openPrint(html);
                  }}>📄 PDF</button>
                </div>
              )}
            </div>

            {/* Meeting cards */}
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {meetings.map(m=>{
                const inv=(m.invIds||[]).map(id=>invByIdFb.get(id)).filter(Boolean);
                const co=coByIdFb.get(m.coId);
                const fb=m.feedback||{};
                const hasFb=!!fb.interestLevel;
                return(
                  <div key={m.id} style={{background:"#fff",border:"1px solid #e9eef5",borderRadius:10,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,57,.04)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:hasFb?"#f9fafb":"#fff",borderBottom:"1px solid #f3f4f6"}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,color:"#000039",fontSize:12}}>{inv.map(i=>i.name).join(", ")||"Sin inversor"}</div>
                        <div style={{fontSize:10,color:"#6b7280",marginTop:1}}>
                          {inv.map(i=>i.fund).filter(Boolean).join(", ")}
                          {co&&<span style={{marginLeft:8,background:"rgba(30,90,176,.07)",color:"#1e5ab0",padding:"1px 6px",borderRadius:3,fontSize:9,fontWeight:600}}>{co.ticker}</span>}
                        </div>
                      </div>
                      {hasFb&&<div style={{flexShrink:0,textAlign:"right"}}><div style={{fontSize:20}}>{["","💤","😐","👍","😃","🔥"][fb.interestLevel]}</div><div style={{fontSize:9,color:INTEREST_COLORS[fb.interestLevel],fontWeight:600,fontFamily:"IBM Plex Mono,monospace"}}>{INTEREST_LABELS[fb.interestLevel]}</div></div>}
                      {!hasFb&&<div style={{fontSize:10,color:"#d1d5db",fontFamily:"IBM Plex Mono,monospace",flexShrink:0}}>sin feedback</div>}
                    </div>
                    <div style={{padding:"12px 14px"}}>
                      <FeedbackWidget compact feedback={fb} onChange={fbNew=>{
                        const updated=meetings.map(mx=>mx.id===m.id?{...mx,feedback:fbNew}:mx);
                        setMeetings(updated);
                        saveCurrentEvent({meetings:updated});
                      }}/>
                    </div>
                  </div>
                );
              })}
              {!meetings.length&&<div style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)"}}>No hay reuniones cargadas aún.</div>}
            </div>
          </div>
        );
      })()}

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
                                    <text x={82+bw+44} y={y2+BAR_H/2+4} fontSize="10" fill="#7a8fa8" fontFamily="IBM Plex Mono">({`${ret}/${total}`})</text>
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

      {tab==="roadshow"&&<RoadshowInboundTab
        roadshow={roadshow} saveRoadshow={saveRoadshow}
        config={config} events={events} globalDB={globalDB}
        rsSubTab={rsSubTab} setRsSubTab={setRsSubTab}
        rsDayFilter={rsDayFilter} setRsDayFilter={setRsDayFilter}
        kioskMode={kioskMode} setKioskMode={setKioskMode}
        kioskIdx={kioskIdx} setKioskIdx={setKioskIdx}
        kioskFb={kioskFb} setKioskFb={setKioskFb}
        kioskFbData={kioskFbData} setKioskFbData={setKioskFbData}
        rsMtgModal={rsMtgModal} setRsMtgModal={setRsMtgModal}
        rsEmailModal={rsEmailModal} setRsEmailModal={setRsEmailModal}
        rsAgendaEmailModal={rsAgendaEmailModal} setRsAgendaEmailModal={setRsAgendaEmailModal}
        icsImportModal={icsImportModal} setIcsImportModal={setIcsImportModal}
        rsMtgsExcelRef={rsMtgsExcelRef} rsExcelRef={rsExcelRef}
        rsShowParser={rsShowParser} setRsShowParser={setRsShowParser}
        rsCoById={rsCoById} rsCoMapForTravel={rsCoMapForTravel} tripDays={tripDays}
        exportCompanyBrief={exportCompanyBrief}
        exportRoadshowSummary={exportRoadshowSummary}
      />}


      {tab==="outbound"&&<RoadshowOutboundTab
        outbound={outbound} saveOutbound={saveOutbound}
        config={config} events={events} globalDB={globalDB}
      />}

      {tab==="activitylog"&&(()=>{
          const log=currentEvent?.activityLog||[];
          return(
            <div>
              <h2 className="pg-h">🕐 Historial de cambios</h2>
              <p className="pg-s">Registro de actividad en este evento.</p>
              {log.length===0?(
                <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)"}}>
                  <div style={{fontSize:32,marginBottom:10}}>📋</div>
                  <div>No hay actividad registrada aún.</div>
                  <div style={{fontSize:11,marginTop:6}}>Las acciones que realices (reuniones, cambios de estado, etc.) aparecerán aquí.</div>
                </div>
              ):(
                <div className="card" style={{padding:0,overflow:"hidden"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:"rgba(30,90,176,.06)"}}>
                        <th style={{padding:"8px 14px",textAlign:"left",fontSize:10,fontFamily:"IBM Plex Mono,monospace",color:"var(--dim)",textTransform:"uppercase",letterSpacing:".06em",fontWeight:600}}>Fecha y hora</th>
                        <th style={{padding:"8px 14px",textAlign:"left",fontSize:10,fontFamily:"IBM Plex Mono,monospace",color:"var(--dim)",textTransform:"uppercase",letterSpacing:".06em",fontWeight:600}}>Usuario</th>
                        <th style={{padding:"8px 14px",textAlign:"left",fontSize:10,fontFamily:"IBM Plex Mono,monospace",color:"var(--dim)",textTransform:"uppercase",letterSpacing:".06em",fontWeight:600}}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {log.map((entry,i)=>{
                        const d=new Date(entry.ts);
                        const fmtTs=isNaN(d)?entry.ts:d.toLocaleString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"});
                        return(
                          <tr key={i} style={{borderTop:"1px solid rgba(30,90,176,.06)",background:i%2===0?"transparent":"rgba(30,90,176,.02)"}}>
                            <td style={{padding:"8px 14px",fontSize:11,fontFamily:"IBM Plex Mono,monospace",color:"var(--dim)",whiteSpace:"nowrap"}}>{fmtTs}</td>
                            <td style={{padding:"8px 14px",fontSize:11,color:"var(--gold)",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.user}</td>
                            <td style={{padding:"8px 14px",fontSize:12,color:"var(--cream)"}}>{entry.action}{entry.detail?<span style={{color:"var(--dim)",marginLeft:6}}>— {entry.detail}</span>:null}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {log.length>=200&&<div style={{padding:"8px 14px",fontSize:11,color:"var(--dim)",textAlign:"center",borderTop:"1px solid rgba(30,90,176,.08)"}}>Mostrando los últimos 200 cambios</div>}
                </div>
              )}
            </div>
          );
        })()}

      {tab==="db"&&<LibraryTab
        globalDB={globalDB} saveGlobalDB={saveGlobalDB} events={events}
        dbTab={dbTab} setDbTab={setDbTab}
        coSearch={coSearch} setCoSearch={setCoSearch}
        invSearch={invSearch} setInvSearch={setInvSearch}
        editCo={editCo} setEditCo={setEditCo}
        editInv={editInv} setEditInv={setEditInv}
        crmSearch={crmSearch} setCrmSearch={setCrmSearch}
        crmFund={crmFund} setCrmFund={setCrmFund}
      />}


    </main>
  </div>
  );
}
