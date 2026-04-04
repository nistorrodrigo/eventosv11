// ── exporters.js — Extracted export functions from App.jsx ────────
import { normalizeFund, COMPANIES_INIT } from "../constants.jsx";
import { downloadBlob } from "../storage.jsx";

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
