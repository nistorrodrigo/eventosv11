// ── parsers.js — File parsing logic extracted from App.jsx ────────
import {
  normalizeFundName, normalizeFund, normalizePosition, normalizeAUM,
  capitalizeName, parseAvail, resolveCo, buildFundAliasMap
} from "../constants.jsx";

// Parse investor Excel file → returns {investors, fundGrouping, fundSimilarities}
export function parseInvestorFile(arrayBuffer, XLSX, config){
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
export function parsePrevYearFile(arrayBuffer, XLSX, currentInvestors, fileName){
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
export function parseHistoricalInvestorFile(arrayBuffer, XLSX, year, fileName){
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
