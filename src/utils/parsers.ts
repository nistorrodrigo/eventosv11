// ── parsers.ts — File parsing logic extracted from App.jsx ────────
import {
  normalizeFundName, normalizeFund, normalizePosition, normalizeAUM,
  capitalizeName, parseAvail, resolveCo, buildFundAliasMap
} from "../constants.jsx";

type XLSX_Module = any; // Full XLSX typing is complex — use any for now
type CompanyMap = Map<string, any>;

// Parse investor Excel file → returns {investors, fundGrouping, fundSimilarities}
export function parseInvestorFile(arrayBuffer: ArrayBuffer, XLSX: XLSX_Module, config: any){
  const wb=XLSX.read(arrayBuffer,{type:"array"});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1});
  if(rows.length<2) return null;
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
  const aliasMap=buildFundAliasMap(parsed);
  const normalized=parsed.map(inv=>({...inv,fund:inv.fund?aliasMap[inv.fund]||inv.fund:inv.fund}));
  const fundSimilarities=[];const seenNorms={};
  parsed.forEach(inv=>{if(!inv.fund)return;const norm=normalizeFund(inv.fund);if(!norm)return;if(seenNorms[norm]&&seenNorms[norm]!==inv.fund){const pair=[seenNorms[norm],inv.fund].sort().join("|||");if(!fundSimilarities.find(p=>p.pair===pair))fundSimilarities.push({pair,canonical:aliasMap[inv.fund],variant:inv.fund,original:seenNorms[norm]});}else seenNorms[norm]=inv.fund;});
  const fg={};const fm={};
  normalized.forEach(inv=>{if(inv.fund){fm[inv.fund]=(fm[inv.fund]||0)+1;}});
  Object.entries(fm).forEach(([f,n])=>{if(n>1)fg[f]=true;});
  return {investors:normalized, fundGrouping:fg, fundSimilarities};
}

// Parse previous year investor file → returns {fileName, total, missing}
export function parsePrevYearFile(arrayBuffer: ArrayBuffer, XLSX: XLSX_Module, currentInvestors: any[], fileName: string){
  const wb=XLSX.read(arrayBuffer,{type:"array"});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1});
  if(rows.length<2) return null;
  const hdrs=rows[0].map(String);
  const ci=pred=>hdrs.findIndex(h=>pred(h.toLowerCase().replace(/[ \t\n\r]+/g," ").trim()));
  const fi=ci(h=>h==="fund"),ni=ci(h=>h==="name"),si=ci(h=>h.startsWith("surname")),ei=ci(h=>h==="email");
  const g=(row,i)=>i>=0?String(row[i]??"").trim():"";
  const prevList=rows.slice(1).filter(row=>g(row,fi)||g(row,ni)).map((row,ri)=>({
    name:capitalizeName([g(row,ni),g(row,si)].filter(Boolean).join(" "))||`Inv ${ri+1}`,
    fund:normalizeFundName(g(row,fi)),
    email:g(row,ei).toLowerCase().trim(),
  }));
  const currentEmails=new Set(currentInvestors.map(i=>i.email?.toLowerCase().trim()).filter(Boolean));
  const currentNameFund=new Set(currentInvestors.map(i=>`${normalizeFund(i.name||"")}|||${normalizeFund(i.fund||"")}`));
  const missing=prevList.filter(p=>{
    if(p.email&&currentEmails.has(p.email))return false;
    if(currentNameFund.has(`${normalizeFund(p.name)}|||${normalizeFund(p.fund)}`))return false;
    return true;
  });
  return {fileName, total:prevList.length, missing};
}

// Parse historical investor file for a given year → returns {year, fileName, investors}
export function parseHistoricalInvestorFile(arrayBuffer: ArrayBuffer, XLSX: XLSX_Module, year: string, fileName: string){
  const wb=XLSX.read(arrayBuffer,{type:"array"});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1});
  if(rows.length<2) return null;
  const hdrs=rows[0].map(String);
  const ci=pred=>hdrs.findIndex(h=>pred(h.toLowerCase().replace(/[ \t\n\r]+/g," ").trim()));
  const fi=ci(h=>h==="fund"),ni=ci(h=>h==="name"),si=ci(h=>h.startsWith("surname")),ei=ci(h=>h==="email");
  const coi=ci(h=>h.includes("which meetings"));
  const g=(row,i)=>i>=0?String(row[i]??"").trim():"";
  const parsed=rows.slice(1).filter(row=>g(row,fi)||g(row,ni)).map((row,ri)=>({
    name:capitalizeName([g(row,ni),g(row,si)].filter(Boolean).join(" "))||`Inv ${ri+1}`,
    fund:normalizeFundName(g(row,fi)),
    email:g(row,ei).toLowerCase().trim(),
    companies:coi>=0?[...new Set(g(row,coi).split(";").map(s=>s.trim()).filter(Boolean).map(resolveCo).filter(Boolean))]:[],
  }));
  if(!parsed.length) return null;
  return {year, fileName, investors:parsed};
}

// Parse roadshow companies Excel → returns array of company objects
export function parseRoadshowCompaniesFile(arrayBuffer: ArrayBuffer, XLSX: XLSX_Module){
  const wb=XLSX.read(arrayBuffer,{type:"array"});
  const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
  if(rows.length<2) return null;
  const hdr=rows[0].map(h=>String(h).toLowerCase().trim());
  const col=k=>hdr.findIndex(h=>h.includes(k));
  const nc=col("name"),tc=col("ticker"),sc=col("sector"),lc=col("location"),cc=col("contact"),ec=col("email"),pc=col("phone"),ac=col("address"),oc=col("notes");
  const newCos=rows.slice(1).filter(r=>r[nc]).map((r,i)=>({
    id:`rc_xl_${Date.now()}_${i}`,name:String(r[nc]||"").trim(),ticker:String(r[tc]||"").trim().toUpperCase(),
    sector:String(r[sc]||"Custom").trim(),location:String(r[lc]||"ls_office").trim().includes("hq")?"hq":"ls_office",
    locationCustom:String(r[ac]||"").trim(),
    contacts:[{id:`rep_${Date.now()}_${i}`,name:String(r[cc]||"").trim(),email:String(r[ec]||"").trim(),phone:String(r[pc]||"").trim(),title:""}].filter(c=>c.name),
    notes:String(r[oc]||"").trim(),active:true
  }));
  return newCos.length?newCos:null;
}

// Parse global DB companies Excel → returns array of company objects with contacts
export function parseDBCompaniesFile(arrayBuffer: ArrayBuffer, XLSX: XLSX_Module){
  const wb=XLSX.read(arrayBuffer,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
  if(rows.length<2) return null;
  const hdr=rows[0].map(h=>String(h).toLowerCase().trim());const ci=k=>hdr.findIndex(h=>h.includes(k));
  const nc=ci("name"),tc=ci("ticker"),sc=ci("sector"),wc=ci("website"),ac=ci("address"),hc=ci("hq"),
    r1c=ci("contact 1"),e1c=ci("email 1"),p1c=ci("phone 1"),t1c=ci("title 1"),
    r2c=ci("contact 2"),e2c=ci("email 2"),p2c=ci("phone 2"),t2c=ci("title 2"),
    r3c=ci("contact 3"),e3c=ci("email 3"),p3c=ci("phone 3"),t3c=ci("title 3");
  const imported=[];
  rows.slice(1).filter(r=>r[nc]).forEach(r=>{
    const name=String(r[nc]).trim();const contacts=[];
    [[r1c,e1c,p1c,t1c],[r2c,e2c,p2c,t2c],[r3c,e3c,p3c,t3c]].forEach(([rc,ec,pc,tc2])=>{
      if(rc>=0&&r[rc]) contacts.push({id:`rep_${Date.now()}_${Math.random().toString(36).slice(2)}`,name:String(r[rc]||"").trim(),email:String(r[ec>=0?ec:""]||"").trim(),phone:String(r[pc>=0?pc:""]||"").trim(),title:String(r[tc2>=0?tc2:""]||"").trim()});
    });
    imported.push({id:`dbc_${Date.now()}_${Math.random().toString(36).slice(2)}`,name,ticker:String(r[tc>=0?tc:""]||"").trim().toUpperCase(),sector:String(r[sc>=0?sc:""]||"Other").trim(),hqAddress:String(r[ac>=0?ac:hc>=0?hc:""]||"").trim(),contacts});
  });
  return imported.length?imported:null;
}

// Parse global DB investors Excel → returns array of investor objects
export function parseDBInvestorsFile(arrayBuffer: ArrayBuffer, XLSX: XLSX_Module){
  const wb=XLSX.read(arrayBuffer,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
  if(rows.length<2) return null;
  const hdr=rows[0].map(h=>String(h).toLowerCase().trim());const ci=k=>hdr.findIndex(h=>h.includes(k));
  const nc=ci("name"),fc=ci("fund"),pc=ci("position"),ec=ci("email"),phc=ci("phone"),ac=ci("aum"),cc=ci("companies"),lc=ci("linkedin"),notc=ci("notes");
  const imported=rows.slice(1).filter(r=>r[nc]).map(r=>({
    id:`dbi_${Date.now()}_${Math.random().toString(36).slice(2)}`,name:String(r[nc]||"").trim(),
    fund:String(r[fc>=0?fc:""]||"").trim(),position:String(r[pc>=0?pc:""]||"").trim(),
    email:String(r[ec>=0?ec:""]||"").trim().toLowerCase(),phone:String(r[phc>=0?phc:""]||"").trim(),
    aum:String(r[ac>=0?ac:""]||"").trim(),companies:String(r[cc>=0?cc:""]||"").split(";").map(s=>s.trim()).filter(Boolean),
    linkedin:String(r[lc>=0?lc:""]||"").trim(),notes:String(r[notc>=0?notc:""]||"").trim(),
  }));
  return imported.length?imported:null;
}

// Parse investor email text → returns {patchTrip, matchedCos}
export function parseInvestorEmail(text: string, knownCompanies: any[], existingRsCompanies: any[]){
  const dateRe=/\b(\d{1,2})[\s/\-](\w+)[\s/\-,]+(\d{4})/g;
  const monthMap={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,jan:1,feb:2,mar:3,apr:4,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  const dates=[];let m;
  while((m=dateRe.exec(text.toLowerCase()))!==null){
    const d=parseInt(m[1]),mo=monthMap[m[2].toLowerCase().slice(0,3)]||parseInt(m[2]),y=parseInt(m[3]);
    if(mo&&d&&y) dates.push(`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  }
  dates.sort();
  const hotelM=text.match(/staying at ([\w\s]+(?:hotel|inn|hilton|hyatt|marriott|sheraton|intercontinental|four seasons|palacio|sofitel|faena)[\w\s]*)/i);
  const hotel=hotelM?hotelM[1].trim():"";
  // Match companies from dynamic list (globalDB + roadshow companies)
  const lower=text.toLowerCase();
  const matched=[];const seenNames=new Set();
  for(const co of knownCompanies){
    if(co.name&&lower.includes(co.name.toLowerCase())&&!seenNames.has(co.name.toLowerCase())){
      seenNames.add(co.name.toLowerCase());
      const existing=(existingRsCompanies||[]).find(c=>c.name.toLowerCase()===co.name.toLowerCase());
      if(!existing) matched.push({id:`rc_${Date.now()}_${Math.random().toString(36).slice(2)}`,name:co.name,ticker:co.ticker||"",sector:co.sector||"Custom",location:"ls_office",contacts:co.contacts||[],hqAddress:co.hqAddress||"",notes:"",active:true});
    }
  }
  const patchTrip={};
  if(dates.length>=2){patchTrip.arrivalDate=dates[0];patchTrip.departureDate=dates[dates.length-1];}
  if(hotel) patchTrip.hotel=hotel;
  return{patchTrip,matchedCos:matched};
}

// Parse roadshow meetings Excel → returns {meetings, skipped}
export function parseRoadshowMeetingsFile(arrayBuffer: ArrayBuffer, XLSX: XLSX_Module, companyMap: CompanyMap){
  const wb=XLSX.read(arrayBuffer,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
  const COL_KEYS=["fecha","date","hora","hour","time","compañ","company","empresa","tipo","type","direc","location","lugar","estado","status","notas","notes"];
  let hdrRowIdx=0;
  for(let i=0;i<Math.min(rows.length,6);i++){const rowStr=rows[i].map(c=>String(c||"").toLowerCase());if(rowStr.filter(cell=>COL_KEYS.some(k=>cell.includes(k))).length>=3){hdrRowIdx=i;break;}}
  const dataRows=rows.slice(hdrRowIdx+1).filter(r=>r.some(c=>String(c||"").trim()));
  if(!dataRows.length) return null;
  const hdr=rows[hdrRowIdx].map(h=>String(h||"").toLowerCase().trim());
  const ci=(...keys)=>hdr.findIndex(h=>keys.some(k=>h.includes(k)));
  const datC=ci("fecha","date"),hourC=ci("hora","hour","time"),coC=ci("compañía","compania","company","empresa"),typeC=ci("tipo","type"),locC=ci("dirección","direccion","location","lugar","address"),statC=ci("estado","status"),notesC=ci("notas","notes","nota");
  const newMtgs=[];let skipped=0;
  dataRows.forEach((r,i)=>{
    const rawDate=String(r[datC]||"").trim();const rawHour=String(r[hourC>=0?hourC:2]||"").trim();
    if(!rawDate||rawDate==="Fecha"||rawDate==="Date")return;
    let dateStr="";
    if(/^\d{5}$/.test(rawDate)){dateStr=new Date(Math.round((parseFloat(rawDate)-25569)*86400*1000)).toISOString().slice(0,10);}
    else if(/\d{4}-\d{2}-\d{2}/.test(rawDate)){dateStr=rawDate.slice(0,10);}
    else if(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/.test(rawDate)){const m=rawDate.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);dateStr=`${m[3].length===2?"20"+m[3]:m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;}
    else{skipped++;return;}
    let hour=9;const numVal=parseFloat(rawHour);
    if(!isNaN(numVal)&&numVal>0&&numVal<1){hour=Math.round(numVal*24);}
    else{const pm=rawHour.match(/pm/i),am=rawHour.match(/am/i),hM=rawHour.match(/(\d{1,2})(?:[:h\.,](\d{0,2}))?/);if(hM){hour=parseInt(hM[1]);if(pm&&hour<12)hour+=12;else if(am&&hour===12)hour=0;else if(!pm&&!am&&hour<8)hour+=12;}}
    hour=Math.max(7,Math.min(20,hour));
    const rawCoName=coC>=0?String(r[coC]||"").trim():"";const rawCoLow=rawCoName.toLowerCase();
    const co=rawCoLow?([...companyMap.entries()].find(([k])=>k.includes(rawCoLow)||rawCoLow.includes(k))||[])[1]:null;
    const typeRaw=typeC>=0?String(r[typeC]||"").toLowerCase():"company";
    const type=typeRaw.includes("internal")||typeRaw.includes("ls")||typeRaw.includes("almuerzo")||typeRaw.includes("lunch")?"ls_internal":"company";
    const locRaw=locC>=0?String(r[locC]||"").trim():"";const locLow=locRaw.toLowerCase();
    let loc="ls_office",locCustom="";
    if(locLow.includes("hq")||locLow.includes("headquarters"))loc="hq";
    else if(locLow.includes("latin securities")||locLow.includes("arenales"))loc="ls_office";
    else if(locRaw.length>4){loc="custom";locCustom=locRaw;}
    const statRaw=statC>=0?String(r[statC]||"tentative").toLowerCase():"tentative";
    const status=statRaw.includes("confirm")||statRaw.includes("✅")?"confirmed":statRaw.includes("cancel")||statRaw.includes("❌")?"cancelled":"tentative";
    newMtgs.push({id:`rsm-xl-${Date.now()}-${i}`,date:dateStr,hour,duration:60,type,companyId:co?.id||"",title:!co?rawCoName:"",location:loc,locationCustom:locCustom,status,notes:notesC>=0?String(r[notesC]||"").trim():"",attendeeIds:[]});
  });
  return newMtgs.length?{meetings:newMtgs,skipped}:null;
}
