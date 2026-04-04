// ── exporters.js — Extracted export functions from App.jsx ────────
import { normalizeFund, COMPANIES_INIT, DEFAULT_DAYS } from "../constants.jsx";
import { downloadBlob } from "../storage.jsx";

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
