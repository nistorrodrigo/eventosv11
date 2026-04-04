// ── exporters.js — Extracted export functions from App.jsx ────────
import { normalizeFund, COMPANIES_INIT, DEFAULT_DAYS } from "../constants.jsx";
import { downloadBlob } from "../storage.jsx";
import { getMeetingAddress, applyBATraffic } from "../travel.js";

// ── Excel export with LS brand colors ─────────────────────────────
export function _exportExcel({XLSX, meetings, investors, companies, config, coById, invById}){
  if(!XLSX){console.warn("XLSX not loaded yet");return;}
  const LS_NAVY="00000039",LS_BLUE="003399ff",LS_BLUE2="001e5ab0",LS_TEAL="0023a29e",LS_GOLD="00c9a227",WHITE="00FFFFFF",LIGHT_BG="00EAF1FB",TEAL_LIGHT="00E0F4F3";
  const wb=XLSX.utils.book_new();
  const setCols=(ws,widths)=>{ws['!cols']=widths.map(w=>({wch:w}));};
  const styleCell=(ws,addr,style)=>{if(!ws[addr])ws[addr]={v:"",t:"s"};ws[addr].s=style;};
  const headerStyle=(bg=LS_NAVY)=>({fill:{patternType:"solid",fgColor:{rgb:bg}},font:{bold:true,color:{rgb:WHITE},sz:10,name:"Calibri"},alignment:{horizontal:"center",vertical:"center",wrapText:true},border:{bottom:{style:"medium",color:{rgb:LS_BLUE}}}});
  const titleStyle={fill:{patternType:"solid",fgColor:{rgb:LS_NAVY}},font:{bold:true,color:{rgb:"00C9A227"},sz:13,name:"Calibri"},alignment:{horizontal:"left",vertical:"center"}};
  const subStyle={fill:{patternType:"solid",fgColor:{rgb:LS_BLUE2}},font:{bold:true,color:{rgb:WHITE},sz:10,name:"Calibri"},alignment:{horizontal:"left",vertical:"center"}};
  const rowStyle=(even,highlight=false)=>({fill:{patternType:"solid",fgColor:{rgb:highlight?TEAL_LIGHT:(even?LIGHT_BG:WHITE)}},font:{color:{rgb:"00000039"},sz:9,name:"Calibri"},alignment:{vertical:"center",wrapText:true},border:{bottom:{style:"thin",color:{rgb:"00CCDDEE"}}}});
  const boldCell=(even)=>({...rowStyle(even),font:{bold:true,color:{rgb:LS_NAVY},sz:9,name:"Calibri"}});
  const getDays=()=>(config.days||DEFAULT_DAYS);

  // Sheet 1: Full Schedule
  {
    const rows=[];const headerRow=["Día","Hora","Compañía","Sector","Inversor","Fondo","Tipo","Sala"];rows.push(headerRow);
    const sorted=[...meetings].sort((a,b)=>{const di=getDays().findIndex(d=>d.id===a.day)-getDays().findIndex(d=>d.id===b.day);if(di!==0)return di;return(a.slot||"").localeCompare(b.slot||"");});
    sorted.forEach(m=>{const co=coById.get(m.coId);const invs=(m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);const day=getDays().find(d=>d.id===m.day);const mFundsX=new Set(invs.map(i=>i.fund||i.id).filter(Boolean));const mType=mFundsX.size<=1?"1x1":"Group";
      if(invs.length===0){rows.push([day?.long||m.day,m.slot,co?.name||m.coId,co?.sector||"","—","—",mType,m.room||""]);}else{invs.forEach((inv,i)=>{rows.push([i===0?day?.long||m.day:"",i===0?m.slot:"",i===0?co?.name||m.coId:"",i===0?co?.sector||"":"",inv.name,inv.fund||"",i===0?mType:"",i===0?m.room||"":""]);});}
    });
    (config.dinners||[]).forEach(d=>{const day=getDays().find(dy=>dy.id===d.day);rows.push([day?.long||d.day,d.time||"",d.name,"Event",d.restaurant||"","","Event",d.address||""]);});
    const ws=XLSX.utils.aoa_to_sheet(rows);setCols(ws,[14,9,22,12,22,22,9,10]);ws['!rows']=[{hpt:22},...rows.slice(1).map(()=>({hpt:18}))];
    XLSX.utils.sheet_add_aoa(ws,[["ARGENTINA IN NEW YORK 2026 — AGENDA COMPLETA"]],{origin:"A1",sheetStubs:true});
    headerRow.forEach((_,ci)=>{styleCell(ws,XLSX.utils.encode_cell({r:1,c:ci}),headerStyle());});
    for(let r=2;r<rows.length;r++){const isEven=r%2===0;const isEvent=rows[r][3]==="Event";for(let c=0;c<8;c++){const addr=XLSX.utils.encode_cell({r:r+1,c});if(!ws[addr])ws[addr]={v:"",t:"s"};ws[addr].s=c===0||c===1||c===2?boldCell(isEven):rowStyle(isEven,isEvent);}}
    ws['!merges']=[{s:{r:0,c:0},e:{r:0,c:7}}];styleCell(ws,"A1",titleStyle);XLSX.utils.book_append_sheet(wb,ws,"Agenda Completa");
  }
  // Sheet 2: Por Compañía
  {
    const aoa=[["ARGENTINA IN NEW YORK 2026 — POR COMPAÑÍA"]];let rowIdx=1;const merges=[{s:{r:0,c:0},e:{r:0,c:5}}];const styleMap={"0:0":titleStyle};
    companies.filter(c=>meetings.some(m=>m.coId===c.id)).forEach(co=>{
      const coMtgs=meetings.filter(m=>m.coId===co.id).sort((a,b)=>{const di=getDays().findIndex(d=>d.id===a.day)-getDays().findIndex(d=>d.id===b.day);return di!==0?di:(a.slot||"").localeCompare(b.slot||"");});
      aoa.push([co.name+" ("+co.ticker+")","","","","",""]);merges.push({s:{r:rowIdx,c:0},e:{r:rowIdx,c:5}});styleMap[rowIdx+":0"]=subStyle;rowIdx++;
      aoa.push(["Día","Hora","Inversor","Fondo","Tipo","Sala"]);for(let c=0;c<6;c++)styleMap[rowIdx+":"+c]=headerStyle(LS_BLUE2);rowIdx++;
      coMtgs.forEach((m,mi)=>{const invs=(m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);const day=getDays().find(d=>d.id===m.day);const mFundsY=new Set(invs.map(i=>i.fund||i.id).filter(Boolean));const mType=mFundsY.size<=1?"1x1":"Group";
        if(invs.length===0){aoa.push([day?.long||m.day,m.slot,"—","",mType,m.room||""]);for(let c=0;c<6;c++)styleMap[rowIdx+":"+c]=rowStyle(mi%2===0);rowIdx++;}else{invs.forEach((inv,ii)=>{aoa.push([ii===0?day?.long||m.day:"",ii===0?m.slot:"",inv.name,inv.fund||"",ii===0?mType:"",ii===0?m.room||"":""]);for(let c=0;c<6;c++)styleMap[rowIdx+":"+c]=(c<2?boldCell(mi%2===0):rowStyle(mi%2===0));rowIdx++;});}
      });aoa.push(["",""," ","","",""]);rowIdx++;
    });
    const ws=XLSX.utils.aoa_to_sheet(aoa);setCols(ws,[16,9,24,22,9,10]);ws['!merges']=merges;
    Object.entries(styleMap).forEach(([key,style])=>{const[r,c]=key.split(":").map(Number);const addr=XLSX.utils.encode_cell({r,c});if(!ws[addr])ws[addr]={v:"",t:"s"};ws[addr].s=style;});
    XLSX.utils.book_append_sheet(wb,ws,"Por Compañía");
  }
  // Sheet 3: Por Inversor
  {
    const aoa=[["ARGENTINA IN NEW YORK 2026 — POR INVERSOR"]];let rowIdx=1;const merges=[{s:{r:0,c:0},e:{r:0,c:4}}];const styleMap={"0:0":titleStyle};
    investors.filter(inv=>meetings.some(m=>(m.invIds||[]).includes(inv.id))).forEach(inv=>{
      const invMtgs=meetings.filter(m=>(m.invIds||[]).includes(inv.id)).sort((a,b)=>{const di=getDays().findIndex(d=>d.id===a.day)-getDays().findIndex(d=>d.id===b.day);return di!==0?di:(a.slot||"").localeCompare(b.slot||"");});
      aoa.push([inv.name+(inv.fund?" — "+inv.fund:""),"","","",""]);merges.push({s:{r:rowIdx,c:0},e:{r:rowIdx,c:4}});styleMap[rowIdx+":0"]=subStyle;rowIdx++;
      aoa.push(["Día","Hora","Compañía","Tipo","Sala"]);for(let c=0;c<5;c++)styleMap[rowIdx+":"+c]=headerStyle(LS_BLUE2);rowIdx++;
      invMtgs.forEach((m,mi)=>{const co=coById.get(m.coId);const day=getDays().find(d=>d.id===m.day);const mInvsZ=(m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);const mFundsZ=new Set(mInvsZ.map(i=>i.fund||i.id).filter(Boolean));const mType=mFundsZ.size<=1?"1x1":"Group";
        aoa.push([day?.long||m.day,m.slot,co?.name||m.coId,mType,m.room||""]);for(let c=0;c<5;c++)styleMap[rowIdx+":"+c]=(c<2?boldCell(mi%2===0):rowStyle(mi%2===0));rowIdx++;
      });aoa.push([""]);rowIdx++;
    });
    const ws=XLSX.utils.aoa_to_sheet(aoa);setCols(ws,[14,9,26,9,10]);ws['!merges']=merges;
    Object.entries(styleMap).forEach(([key,style])=>{const[r,c]=key.split(":").map(Number);const addr=XLSX.utils.encode_cell({r,c});if(!ws[addr])ws[addr]={v:"",t:"s"};ws[addr].s=style;});
    XLSX.utils.book_append_sheet(wb,ws,"Por Inversor");
  }
  // Sheet 4: Lista de Inversores
  {
    const header=["Nombre","Fondo","Email","Teléfono","Cargo","AUM","Reuniones Asignadas","Compañías Solicitadas"];
    const rows=[header,...investors.map(inv=>{const nMtgs=meetings.filter(m=>(m.invIds||[]).includes(inv.id)).length;return[inv.name,inv.fund||"",inv.email||"",inv.phone||"",inv.position||"",inv.aum||"",nMtgs,(inv.companies||[]).map(cid=>{const co=coById.get(cid);return co?.ticker||cid;}).join(", ")];})];
    const ws=XLSX.utils.aoa_to_sheet(rows);setCols(ws,[24,22,28,16,18,10,10,34]);ws['!rows']=[{hpt:22},...investors.map(()=>({hpt:16}))];
    header.forEach((_,ci)=>{const addr=XLSX.utils.encode_cell({r:0,c:ci});if(!ws[addr])ws[addr]={v:"",t:"s"};ws[addr].s=headerStyle();});
    for(let r=1;r<rows.length;r++){const isEven=r%2===0;for(let c=0;c<8;c++){const addr=XLSX.utils.encode_cell({r,c});if(!ws[addr])ws[addr]={v:"",t:"s"};ws[addr].s=(c===0?boldCell(isEven):rowStyle(isEven));}}
    XLSX.utils.book_append_sheet(wb,ws,"Inversores");
  }
  const wbout=XLSX.write(wb,{bookType:"xlsx",type:"array",cellStyles:true});
  downloadBlob("ArgentinaInNY2026_LatinSecurities.xlsx",new Blob([wbout],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

export function exportHistoricalHTML(histYears, currInvestors, currCompanies, currMeetings){
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

  const yearStats = allDatasets.map(({year,investors:invs},i)=>{
    const prevYrs = allYears.slice(0,i);
    const prevKeys = new Set(prevYrs.flatMap(y=>[...yearKeySets[y]]));
    const myKeys = [...yearKeySets[year]];
    const returning = myKeys.filter(k=>prevKeys.has(k)).length;
    return {year, total:invs.length, returning, newCount:invs.length-returning, isAct:year===currentYearLabel};
  });

  const missing = Object.values(invYearMap).filter(v=>!v.years.has(currentYearLabel)&&v.years.size>0).sort((a,b)=>b.years.size-a.years.size);
  const returning = Object.values(invYearMap).filter(v=>v.years.has(currentYearLabel)&&v.years.size>1).sort((a,b)=>b.years.size-a.years.size);

  const coDemand = {};
  COMPANIES_INIT.forEach(c=>{coDemand[c.id]={};});
  allDatasets.forEach(({year,investors:invs})=>{
    invs.forEach(inv=>{(inv.companies||[]).forEach(cid=>{if(coDemand[cid])coDemand[cid][year]=(coDemand[cid][year]||0)+1;});});
  });
  const coTotals = COMPANIES_INIT.map(c=>({...c,total:allYears.reduce((s,yr)=>s+(coDemand[c.id][yr]||0),0)})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total).slice(0,14);
  const maxCo = Math.max(...coTotals.map(c=>c.total),1);

  const COLORS=["#9b59b6","#e67e22","#3399ff","#23a29e","#1e5ab0","#3a8c5c"];
  const BH=28,BG=8,LW=100;

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
  <div class="card"><h3>Participación por edición</h3>${partSVG}</div>
  <div class="card"><h3>% que vuelve al año actual</h3>${retPairs.length>0?retSVG:"<p style='color:#7a8fa8;font-size:12px'>Cargá años anteriores para ver retención.</p>"}</div>
</div>

<h2>Demanda por Compañía</h2>
<div class="card">${coSVG}</div>

<h2>Tendencia por compañía</h2>
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
<h2>Inversores que volvieron (${returning.length})</h2>
<table>
  <thead><tr><th>#</th><th>Nombre</th><th>Fondo</th><th>Email</th><th>Ediciones</th></tr></thead>
  <tbody>${returning.slice(0,30).map(({info,years},i)=>`
    <tr><td>${i+1}</td><td><strong>${info.name}</strong></td><td style="color:#7a8fa8">${info.fund||"—"}</td>
    <td style="font-size:10px;color:#7a8fa8">${info.email||"—"}</td>
    <td>${[...years].sort().map(yr=>`<span class="badge ${yr==="Actual"?"gold":""}">${yr==="Actual"?"Actual":yr}</span>`).join("")}</td></tr>`).join("")}
  </tbody>
</table>`:""}

${missing.length>0?`
<h2>Inversores que no volvieron (${missing.length})</h2>
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

// ── Driver Itinerary export ───────────────────────────────────────
export function _exportDriverItinerary({filterDate, roadshow, travelCache, tripDays, config, openPrint, toast}){
  const {trip,meetings,companies}=roadshow;
  const rsCoMap=new Map((companies||[]).map(c=>[c.id,c]));
  const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
  const addMinutes=(h,min)=>h+min/60;
  const subMinutes=(h,min)=>Math.max(0,h-min/60);
  const dur=trip.meetingDuration||60;
  const hotel=trip.hotel||"Hotel";
  const fund=trip.fund||trip.clientName||"Roadshow";
  const workDays=tripDays.filter(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;});
  const days=filterDate?[filterDate]:workDays;

  const dayBlocks=days.map(date=>{
    const dayMtgs=(meetings||[]).filter(m=>m.date===date&&m.status!=="cancelled").sort((a,b)=>a.hour-b.hour);
    if(!dayMtgs.length)return null;
    const dayT=travelCache[date]||{};
    const _overridesMap=roadshow.travelOverrides||{};
    const getTravel=(key,deptH)=>{if(dayT[key])return dayT[key];const ov=_overridesMap[key];return ov!=null?{...applyBATraffic(ov,deptH,null),source:"manual"}:null;};
    const fmtDate=new Date(date+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
    const leg0=getTravel(`${date}-0`,dayMtgs[0].hour);
    const hotelTravelMin=leg0?.durationSec?Math.ceil(leg0.durationSec/60)+5:20;
    const pickupH=subMinutes(dayMtgs[0].hour,hotelTravelMin+10);
    let rows=`<tr class="hotel-row"><td class="time-cell">${fmtH(pickupH)}</td><td class="event-cell"><div class="event-title">🏨 Salida del hotel</div><div class="event-sub">${hotel}</div></td><td class="info-cell"><span class="badge badge-hotel">~${hotelTravelMin} min al destino</span></td></tr><tr class="gap-row"><td></td><td colspan="2"><div class="gap-line">🚗 traslado ≈ ${hotelTravelMin} min</div></td></tr>`;
    dayMtgs.forEach((m,mi)=>{
      const co=m.type==="company"?rsCoMap.get(m.companyId):null;
      const name=co?co.name:(m.lsType||m.title||"Reunión");
      const ticker=co?.ticker||"";
      const addr=getMeetingAddress(m,co,trip.officeAddress);
      const endH=m.hour+dur/60;
      const sector=co?.sector||"";
      const clrMap={"Financials":"#1e5ab0","Energy":"#e8850a","Utilities":"#23a29e","TMT":"#7c3aed","Infra":"#059669","Industry":"#b45309","Consumer":"#dc2626","Agro":"#65a30d","Exchange":"#0891b2","Real Estate":"#d97706","Other":"#6b7280","LS Internal":"#374151"};
      const clr=clrMap[sector]||"#374151";
      const allC=co?.contacts||[];const selIds=m.attendeeIds||[];const reps=selIds.length?allC.filter(c=>selIds.includes(c.id)):allC;
      const repHTML=reps.filter(r=>r.name).map(r=>{const ph=r.phone?`<a href="tel:${r.phone.replace(/\s/g,'')}" style="color:#1e5ab0;text-decoration:none">📞 ${r.phone}</a>`:"";const wa=r.phone?`<a href="https://wa.me/${r.phone.replace(/[^\d]/g,'')}" style="color:#25d166;text-decoration:none;margin-left:6px">💬</a>`:"";return `<div style="margin-top:3px"><strong>${r.name}</strong>${r.title?` <span style="color:#6b7280;font-size:9pt">(${r.title})</span>`:""} ${ph}${wa}</div>`;}).join("");
      const statusBadge=m.status==="confirmed"?`<span class="badge badge-conf">✓ Confirmada</span>`:`<span class="badge badge-tent">◌ Tentativa</span>`;
      rows+=`<tr class="mtg-row"><td class="time-cell"><div style="font-weight:800;color:${clr}">${fmtH(m.hour)}</div><div style="font-size:8.5pt;color:#9ca3af;margin-top:1px">${fmtH(endH)}</div></td><td class="event-cell"><div class="event-title" style="color:${clr}">${name}${ticker?` <span class="ticker">${ticker}</span>`:""}</div><div class="event-sub">📍 ${addr}</div>${repHTML?`<div class="reps">${repHTML}</div>`:""}</td><td class="info-cell">${statusBadge}<div style="font-size:9pt;color:#6b7280;margin-top:5px">⏱ ${dur} min</div>${m.notes?`<div style="font-size:9pt;color:#374151;margin-top:5px;font-style:italic">📝 ${m.notes}</div>`:""}</td></tr>`;
      if(mi<dayMtgs.length-1){const tData=getTravel(`${date}-${mi}`,m.hour+dur/60);const nextM=dayMtgs[mi+1];const gapMin=Math.round((nextM.hour-m.hour)*60-dur);const tMin=tData?Math.ceil(tData.durationSec/60):null;const conflict=tMin!=null&&gapMin<tMin;const warn=tMin!=null&&!conflict&&gapMin<tMin+10;const gapColor=conflict?"#dc2626":warn?"#d97706":"#059669";const travelSource=tData?.source==="osrm+traffic"?" (tráfico CABA est.)":(tData?" (sin tráfico)":"");const travelTxt=tData?`🚗 ${tData.durationText} · ${tData.distanceText}${travelSource}`:"🚗 traslado (tiempo no calculado)";const marginTxt=tMin!=null?` · ${gapMin-tMin} min de margen`:`${gapMin} min entre reuniones`;rows+=`<tr class="gap-row"><td></td><td colspan="2"><div class="gap-line" style="color:${gapColor}">${travelTxt}<span style="font-size:9pt;color:${gapColor};margin-left:8px">${conflict?"⚠ CONFLICTO":warn?"⚡ justo":""} ${marginTxt}</span></div></td></tr>`;}
    });
    const lastM=dayMtgs[dayMtgs.length-1];const returnH=addMinutes(lastM.hour,dur);const lastLeg=getTravel(`${date}-${dayMtgs.length-2}`,dayMtgs[dayMtgs.length-2]?.hour+dur/60);const returnMin=lastLeg?Math.ceil(lastLeg.durationSec/60)+5:20;
    rows+=`<tr class="gap-row"><td></td><td colspan="2"><div class="gap-line">🚗 traslado ≈ ${returnMin} min</div></td></tr><tr class="hotel-row"><td class="time-cell">${fmtH(addMinutes(returnH,returnMin))}</td><td class="event-cell"><div class="event-title">🏨 Regreso al hotel</div><div class="event-sub">${hotel}</div></td><td class="info-cell"></td></tr>`;
    return `<div class="day-block"><div class="day-hdr"><div class="day-label">${fmtDate.charAt(0).toUpperCase()+fmtDate.slice(1)}</div><div class="day-meta">${dayMtgs.length} reunión${dayMtgs.length!==1?"es":""} · ${dur} min c/u</div></div><table class="day-table"><tbody>${rows}</tbody></table></div>`;
  }).filter(Boolean).join("");

  if(!dayBlocks){toast("No hay reuniones para el itinerario.");return;}
  const travelNote=Object.keys(travelCache).length?"✓ Rango de traslado estimado con tráfico típico de CABA por hora del día (OpenStreetMap + OSRM, sin API key).":"⚠ Tiempos de traslado no calculados — hacé click en 🔄 Calcular en el tab 🗺️ Recorrido para ver rangos de tráfico.";
  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Itinerario del chofer — ${fund}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}@page{margin:12mm 15mm;size:A4}body{font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10pt;color:#111827;background:#fff;padding:20px 24px}.hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;margin-bottom:20px;border-bottom:3px solid #000039}.ls1{font-size:13pt;font-weight:800;color:#000039;letter-spacing:.12em;text-transform:uppercase}.ls2{font-size:6.5pt;color:#6b7280;letter-spacing:.2em;text-transform:uppercase;margin-top:2px}.day-block{margin-bottom:24px;break-inside:avoid}.day-hdr{background:#000039;color:#fff;padding:9px 14px;border-radius:7px 7px 0 0;display:flex;align-items:center;justify-content:space-between}.day-label{font-size:12pt;font-weight:700;text-transform:capitalize;letter-spacing:.03em}.day-meta{font-size:9pt;opacity:.6;font-family:'IBM Plex Mono',monospace}.day-table{width:100%;border-collapse:collapse;border:1px solid #e9eef5;border-top:none;border-radius:0 0 7px 7px;overflow:hidden}.time-cell{width:58px;padding:8px 10px;vertical-align:top;font-family:'IBM Plex Mono',monospace;font-size:11pt;font-weight:700;color:#000039;white-space:nowrap;border-bottom:1px solid #f3f4f6}.event-cell{padding:8px 12px;vertical-align:top;border-bottom:1px solid #f3f4f6}.info-cell{width:140px;padding:8px 10px;vertical-align:top;border-bottom:1px solid #f3f4f6}.event-title{font-size:12pt;font-weight:700;margin-bottom:2px}.event-sub{font-size:9.5pt;color:#6b7280;margin-top:2px}.reps{margin-top:5px;padding-top:5px;border-top:1px solid #f3f4f6;font-size:9.5pt}.ticker{background:#e8eef8;color:#1e5ab0;padding:1px 5px;border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:8.5pt;font-weight:700;margin-left:3px}.gap-row td{padding:0;border:none}.gap-line{font-size:9pt;color:#6b7280;padding:4px 12px 4px 14px;font-family:'IBM Plex Mono',monospace;border-left:2px dashed #e9eef5;margin-left:29px}.hotel-row .time-cell{color:#374151;font-size:10pt}.hotel-row .event-title{font-size:11pt;color:#374151}.hotel-row{background:#f9fafb}.badge{display:inline-block;font-size:8.5pt;padding:2px 7px;border-radius:4px;font-weight:600}.badge-conf{background:#dcfce7;color:#166534}.badge-tent{background:#fef9c3;color:#854d0e}.badge-hotel{background:#eff6ff;color:#1e5ab0}.note{font-size:8pt;color:#9ca3af;margin-top:14px;padding-top:8px;border-top:1px solid #f3f4f6}.footer{margin-top:16px;padding-top:8px;border-top:1px solid #e9eef5;display:flex;justify-content:space-between;font-size:7.5pt;color:#9ca3af}@media print{body{padding:0}.day-block{break-inside:avoid}}</style></head><body>
<div class="hdr"><div><div class="ls1">Latin Securities</div><div class="ls2">Roadshow · Driver Itinerary</div></div><div style="text-align:right;font-size:9pt;color:#6b7280"><div style="font-weight:700;color:#000039;font-size:11pt">${fund}</div><div>${hotel}</div></div></div>
${dayBlocks}
<div class="note">⚠ Los horarios de salida/regreso al hotel son estimativos. ${travelNote}</div>
<div class="footer"><span>Latin Securities · Confidential</span><span>${fund} · Driver Itinerary</span></div>
</body></html>`;
  openPrint(html);
}

// ── Roadshow Summary export ───────────────────────────────────────
export function _exportRoadshowSummary({roadshow, openPrint}){
  const {trip,meetings,companies}=roadshow;
  const rsCoMap=new Map((companies||[]).map(c=>[c.id,c]));
  const allMtgs=(meetings||[]).filter(m=>m.status!=="cancelled");
  const conf=allMtgs.filter(m=>m.status==="confirmed");
  const tent=allMtgs.filter(m=>m.status==="tentative");
  const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
  const fmtDate=iso=>new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"});
  const bySector={};allMtgs.forEach(m=>{const co=m.type==="company"?rsCoMap.get(m.companyId):null;const sec=co?.sector||"LS Internal";if(!bySector[sec])bySector[sec]={total:0,conf:0};bySector[sec].total++;if(m.status==="confirmed")bySector[sec].conf++;});
  const byDay={};allMtgs.forEach(m=>{if(!byDay[m.date])byDay[m.date]=[];byDay[m.date].push(m);});Object.values(byDay).forEach(arr=>arr.sort((a,b)=>a.hour-b.hour));
  const days=Object.keys(byDay).sort();
  const visitorLine=(trip.visitors||[]).filter(v=>v.name).map(v=>v.name).join(", ")||trip.clientName||"—";
  const fund=trip.fund||trip.clientName||"Roadshow";
  const pct=allMtgs.length?Math.round(conf.length/allMtgs.length*100):0;
  const RS_CLR_MAP={"Financials":"#1e5ab0","Energy":"#e8850a","Utilities":"#23a29e","TMT":"#7c3aed","Infra":"#059669","Industry":"#b45309","Consumer":"#dc2626","Agro":"#65a30d","Exchange":"#0891b2","Real Estate":"#d97706","Other":"#6b7280","LS Internal":"#374151"};
  const sectorRows=Object.entries(bySector).sort((a,b)=>b[1].total-a[1].total).map(([sec,d])=>{const pctS=d.total?Math.round(d.conf/d.total*100):0;const clr=RS_CLR_MAP[sec]||"#6b7280";return `<tr><td style="padding:6px 12px;font-weight:600;color:${clr}">${sec}</td><td style="padding:6px 12px;text-align:center">${d.total}</td><td style="padding:6px 12px;text-align:center;color:#166534">${d.conf}</td><td style="padding:6px 12px;text-align:center"><div style="background:#f3f4f6;border-radius:3px;height:6px;overflow:hidden"><div style="background:${clr};height:100%;width:${pctS}%"></div></div></td></tr>`;}).join("");
  const dayRows=days.map(date=>{const mtgs=byDay[date];const rows=mtgs.map(m=>{const co=m.type==="company"?rsCoMap.get(m.companyId):null;const name=co?`${co.name}${co.ticker?" ("+co.ticker+")":""}`: (m.lsType||m.title||"Interno");const locStr=m.location==="ls_office"?(trip.officeAddress||"LS Offices"):m.location==="hq"?(co?co.hqAddress||co.name+" HQ":"HQ"):(m.locationCustom||"TBD");const hasPost=m.postNotes?`<div style="color:#166534;font-size:9pt;margin-top:2px">✅ ${m.postNotes.slice(0,100)}${m.postNotes.length>100?"…":""}</div>`:"";const allC=co?.contacts||[];const actIds=m.actualAttendees;const actReps=actIds!=null?(actIds.length?allC.filter(c=>actIds.includes(c.id)).map(c=>c.name).join(", "):"Nadie marcado"):"";const statusBadge=m.status==="confirmed"?`<span style="background:#dcfce7;color:#166534;padding:2px 7px;border-radius:3px;font-size:8.5pt;font-weight:600">✓ Confirmed</span>`:`<span style="background:#fef9c3;color:#854d0e;padding:2px 7px;border-radius:3px;font-size:8.5pt">◌ Tentative</span>`;return `<tr style="border-bottom:1px solid #f3f4f6"><td style="padding:6px 10px;font-family:'IBM Plex Mono',monospace;font-size:9pt;color:#6b7280;white-space:nowrap">${fmtH(m.hour)}</td><td style="padding:6px 10px"><div style="font-weight:600;color:#000039">${name}</div>${hasPost}${actReps?`<div style="font-size:9pt;color:#6b7280;margin-top:2px">👤 ${actReps}</div>`:""}</td><td style="padding:6px 10px;font-size:9.5pt;color:#374151">${locStr}</td><td style="padding:6px 10px">${statusBadge}</td></tr>`;}).join("");return `<div style="margin-bottom:20px"><div style="background:#000039;color:#fff;padding:8px 14px;border-radius:6px 6px 0 0;font-family:'IBM Plex Mono',monospace;font-size:9pt;letter-spacing:.08em;text-transform:uppercase">${fmtDate(date)}</div><table style="width:100%;border-collapse:collapse;border:1px solid #e9eef5;border-top:none;border-radius:0 0 6px 6px;overflow:hidden"><colgroup><col width="60"><col><col width="200"><col width="110"></colgroup>${rows}</table></div>`;}).join("");
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Resumen — ${fund}</title><style>*{box-sizing:border-box;margin:0;padding:0}@page{margin:15mm 18mm;size:A4}body{font-family:'Segoe UI',Calibri,sans-serif;font-size:10.5pt;color:#111827;background:#fff;padding:20px 24px}.hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;margin-bottom:20px;border-bottom:2.5px solid #000039}.ls1{font-size:13pt;font-weight:800;color:#000039;letter-spacing:.12em;text-transform:uppercase}.ls2{font-size:6.5pt;color:#6b7280;letter-spacing:.2em;text-transform:uppercase;margin-top:2px}.kpi-row{display:flex;gap:12px;margin-bottom:20px}.kpi{flex:1;padding:14px 16px;border:1px solid #e9eef5;border-radius:8px;background:#f9fafb;text-align:center}.kpi-num{font-family:'Georgia',serif;font-size:26pt;font-weight:700;color:#000039;line-height:1}.kpi-lbl{font-size:8pt;color:#9ca3af;text-transform:uppercase;letter-spacing:.1em;margin-top:4px;font-family:'IBM Plex Mono',monospace}.sec-title{font-size:10pt;font-weight:700;color:#000039;margin-bottom:10px;text-transform:uppercase;letter-spacing:.08em;padding-bottom:4px;border-bottom:2px solid #e9eef5}table.sec-tbl{width:100%;border-collapse:collapse;border:1px solid #e9eef5;border-radius:6px;overflow:hidden;margin-bottom:20px}table.sec-tbl th{background:#f3f4f6;padding:6px 12px;text-align:left;font-size:8.5pt;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;font-weight:600;border-bottom:1px solid #e9eef5}.footer{margin-top:20px;padding-top:8px;border-top:1px solid #e9eef5;display:flex;justify-content:space-between;font-size:7.5pt;color:#9ca3af}@media print{body{padding:0}.kpi{break-inside:avoid}}</style></head><body>
<div class="hdr"><div><div class="ls1">Latin Securities</div><div class="ls2">Roadshow · Post-Trip Summary</div></div><div style="text-align:right;font-size:9pt;color:#6b7280"><div style="font-weight:700;color:#000039;font-size:11pt">${fund}</div><div>${trip.arrivalDate?new Date(trip.arrivalDate+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"long"}):""}${trip.departureDate?" – "+new Date(trip.departureDate+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"}):""}</div><div>${visitorLine}</div></div></div>
<div class="kpi-row"><div class="kpi"><div class="kpi-num">${allMtgs.length}</div><div class="kpi-lbl">Total Meetings</div></div><div class="kpi"><div class="kpi-num" style="color:#166534">${conf.length}</div><div class="kpi-lbl">Confirmed</div></div><div class="kpi"><div class="kpi-num" style="color:#854d0e">${tent.length}</div><div class="kpi-lbl">Tentative</div></div><div class="kpi"><div class="kpi-num">${pct}%</div><div class="kpi-lbl">Conf. Rate</div></div><div class="kpi"><div class="kpi-num">${days.length}</div><div class="kpi-lbl">Days</div></div></div>
<div class="sec-title">Coverage by Sector</div><table class="sec-tbl"><tr><th>Sector</th><th style="text-align:center">Total</th><th style="text-align:center">Confirmed</th><th>% Confirmed</th></tr>${sectorRows}</table>
<div class="sec-title">Meeting Schedule</div>${dayRows}
${days.some(d=>byDay[d].some(m=>m.postNotes))?`<div class="sec-title">Post-Meeting Notes</div>${days.flatMap(d=>byDay[d].filter(m=>m.postNotes).map(m=>{const co=m.type==="company"?rsCoMap.get(m.companyId):null;return `<div style="margin-bottom:12px;padding:10px 14px;border-left:3px solid #166534;background:#f0fdf4;border-radius:0 6px 6px 0"><div style="font-weight:600;color:#000039;margin-bottom:4px">${co?co.name:(m.lsType||m.title||"Interno")} · ${fmtDate(m.date)} ${fmtH(m.hour)}</div><div style="font-size:10pt;color:#166534;line-height:1.6">${m.postNotes}</div></div>`;})).join("")}`:""}
<div class="footer"><span>Latin Securities · Confidential</span><span>${fund} · Post-Trip Summary</span></div></body></html>`;
  openPrint(html);
}

// ── Company Brief one-pager ───────────────────────────────────────
export function _exportCompanyBrief({co, roadshow, openPrint}){
  const mtg=(roadshow.meetings||[]).find(m=>m.type==="company"&&m.companyId===co.id);
  const trip=roadshow.trip;
  const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
  const locStr=!mtg?"TBD":mtg.location==="ls_office"?(trip.officeAddress||"Arenales 707, 6° Piso, CABA"):mtg.location==="hq"?(co.hqAddress||co.name+" HQ"):(mtg.locationCustom||"TBD");
  const dateStr=mtg?new Date(mtg.date+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}):"Sin fecha";
  const contacts=(co.contacts||[]).filter(c=>c.name);const selIds=mtg?.attendeeIds||[];const mtgContacts=selIds.length?contacts.filter(c=>selIds.includes(c.id)):contacts;
  const visitorLine=(trip.visitors||[]).filter(v=>v.name).map(v=>v.name+(v.title?" – "+v.title:"")).join(" · ")||trip.clientName||"";
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Brief – ${co.name}</title><style>*{box-sizing:border-box;margin:0;padding:0}@page{margin:18mm 20mm;size:A4}body{font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:11pt;color:#111827;background:#fff;padding:24px 28px}.hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;margin-bottom:20px;border-bottom:2.5px solid #000039}.ls-wm1{font-size:13pt;font-weight:800;color:#000039;letter-spacing:.12em;text-transform:uppercase}.ls-wm2{font-size:6.5pt;color:#6b7280;letter-spacing:.2em;text-transform:uppercase;margin-top:2px}.co-header{margin-bottom:20px}.co-name{font-size:22pt;font-weight:700;color:#000039;font-family:'Georgia',serif;line-height:1.15}.co-meta{display:flex;gap:14px;margin-top:6px;flex-wrap:wrap}.badge{font-size:9pt;padding:3px 10px;border-radius:20px;font-weight:600;background:#f0f4ff;color:#1e5ab0;border:1px solid #c7d7f7}.section{margin-bottom:18px;padding:14px 16px;border-radius:8px;border:1px solid #e9eef5;background:#f9fafb}.sec-label{font-size:8.5pt;text-transform:uppercase;letter-spacing:.15em;color:#9ca3af;font-weight:700;margin-bottom:8px}.meeting-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin-bottom:18px}.meet-row{display:flex;gap:8px;margin-bottom:5px;font-size:10.5pt}.meet-label{color:#6b7280;min-width:80px;font-size:9.5pt}.contact-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f3f4f6;font-size:10pt}.contact-row:last-child{border-bottom:none}.notes-box{background:#fff;border:1px solid #e9eef5;border-radius:6px;padding:12px;min-height:60px;font-size:10pt;color:#374151;line-height:1.6;white-space:pre-wrap}.post-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px;min-height:60px;font-size:10pt;color:#166534;line-height:1.6;white-space:pre-wrap}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #e9eef5;display:flex;justify-content:space-between;font-size:8pt;color:#9ca3af}@media print{body{padding:0}.section,.meeting-box{break-inside:avoid}}</style></head><body>
<div class="hdr"><div><div class="ls-wm1">Latin Securities</div><div class="ls-wm2">Investment Banking · Buenos Aires</div></div><div style="text-align:right;font-size:9pt;color:#6b7280">${trip.fund||trip.clientName||"Roadshow"}<br/>${dateStr}</div></div>
<div class="co-header"><div class="co-name">${co.name}</div><div class="co-meta">${co.ticker?`<span class="badge">${co.ticker}</span>`:""}${co.sector?`<span class="badge" style="background:#f9fafb;color:#374151;border-color:#e5e7eb">${co.sector}</span>`:""}${mtg?.status==="confirmed"?`<span class="badge" style="background:#dcfce7;color:#166534;border-color:#86efac">✓ Confirmed</span>`:mtg?.status==="tentative"?`<span class="badge" style="background:#fef9c3;color:#854d0e;border-color:#fde68a">◌ Tentative</span>`:""}</div></div>
<div class="meeting-box"><div class="sec-label">Meeting Details</div><div class="meet-row"><span class="meet-label">📅 Date</span><strong>${dateStr}</strong></div>${mtg?`<div class="meet-row"><span class="meet-label">⏰ Time</span><strong>${fmtH(mtg.hour)} – ${fmtH(mtg.hour+(trip.meetingDuration||60)/60)} (${trip.meetingDuration||60} min)</strong></div>`:""}<div class="meet-row"><span class="meet-label">📍 Location</span>${locStr}</div>${visitorLine?`<div class="meet-row"><span class="meet-label">👤 Investor</span>${visitorLine}</div>`:""}${mtg?.meetingFormat&&mtg.meetingFormat!=="Meeting"?`<div class="meet-row"><span class="meet-label">🍽 Format</span>${mtg.meetingFormat}</div>`:""}</div>
${mtgContacts.length?`<div class="section"><div class="sec-label">Company Representatives</div>${mtgContacts.map(c=>`<div class="contact-row"><span style="font-weight:600">${c.name}</span><span style="color:#6b7280">${c.title||""}</span><span style="color:#374151;font-size:9.5pt">${c.email||""}</span></div>`).join("")}</div>`:""}
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px"><div><div class="sec-label" style="margin-bottom:6px">📋 Pre-meeting notes</div><div class="notes-box">${(mtg?.notes||co.notes||"—").replace(/</g,"&lt;")}</div></div><div><div class="sec-label" style="margin-bottom:6px">✅ Post-meeting notes</div><div class="post-box">${(mtg?.postNotes||"").replace(/</g,"&lt;")||"<span style='color:#9ca3af;font-style:italic'>Complete after the meeting</span>"}</div></div></div>
${co.hqAddress?`<div class="section"><div class="sec-label">Company Address</div><div style="font-size:10.5pt">${co.hqAddress}</div></div>`:""}
<div class="footer"><span>Latin Securities · Confidential</span><span>${co.name} · ${trip.fund||trip.clientName||""}</span></div></body></html>`;
  openPrint(html);
}
