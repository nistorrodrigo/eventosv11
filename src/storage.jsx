// ── storage.js — persistence, zip, HTML export builders ──
import * as XLSX from 'xlsx';

/* ═══════════════════════════════════════════════════════════════════
   PERSISTENCE — localStorage (works in real browser / Vercel)
═══════════════════════════════════════════════════════════════════ */
export const LS_KEY = "arginny_events_v1";
export const LS_DB_KEY = "ls_global_db_v1";
export function loadEvents(){try{const evs=JSON.parse(localStorage.getItem(LS_KEY)||"[]");const clean=evs.filter(e=>!e._shared);if(clean.length<evs.length)saveEvents(clean);return clean;}catch{return[];}}
export function saveEvents(events){try{localStorage.setItem(LS_KEY,JSON.stringify(events));}catch{}}
export function loadDB(){try{return JSON.parse(localStorage.getItem(LS_DB_KEY)||'{"companies":[],"investors":[]}');}catch{return{companies:[],investors:[]};}}
export function saveDB(db){try{localStorage.setItem(LS_DB_KEY,JSON.stringify(db));}catch{}}

/* ═══════════════════════════════════════════════════════════════════
   ZIP
═══════════════════════════════════════════════════════════════════ */
export const CRC_TBL =(()=>{const t=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;t[i]=c;}return t;})();
export function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=(c>>>8)^CRC_TBL[(c^b[i])&0xFF];return(c^0xFFFFFFFF)>>>0;}
export function u16(n){return[n&0xFF,(n>>8)&0xFF];}function u32(n){return[n&0xFF,(n>>8)&0xFF,(n>>16)&0xFF,(n>>24)&0xFF];}
export function cat(...arrs){const total=arrs.reduce((s,a)=>s+a.length,0);const out=new Uint8Array(total);let i=0;for(const a of arrs){out.set(a,i);i+=a.length;}return out;}
export function buildZip(files){
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
export function downloadBlob(name,content,type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(url),5000);}

/* ═══════════════════════════════════════════════════════════════════
   EXPORT HTML builders
═══════════════════════════════════════════════════════════════════ */
export const esc =s=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

export function buildWordHTML(name,sub,sections,meta={}){
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

export function buildPrintHTML(entities,meta={}){
  // Status badge helper
  function stBadge(st){
    if(!st) return '';
    const s=st.toLowerCase();
    const cfg=s.includes('confirm')?{bg:'#dcfce7',col:'#166534',lbl:'✓ Confirmed'}:
              s.includes('cancel')?{bg:'#fee2e2',col:'#991b1b',lbl:'✗ Cancelled'}:
              {bg:'#fef9c3',col:'#854d0e',lbl:'◌ Tentative'};
    return `<span style="display:inline-block;padding:2px 7px;border-radius:4px;font-size:8.5pt;font-weight:600;background:${cfg.bg};color:${cfg.col}">${cfg.lbl}</span>`;
  }
  // Meeting type color
  function typeClr(t){
    const m={'Breakfast':'#7c3aed','Lunch':'#0369a1','Dinner':'#b45309','Company Visit':'#065f46','Conference Call':'#1d4ed8','Presentation':'#7c3aed'};
    return m[t]||'#374151';
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Latin Securities · Schedule</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Calibri,Arial,sans-serif;font-size:10.5pt;color:#111827;background:#fff}
@page{margin:18mm 20mm 16mm;size:A4}
.page{max-width:780px;margin:0 auto;padding:20px 24px 24px}
.page+.page{page-break-before:always;padding-top:24px}
/* Header */
.ls-hdr{display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;margin-bottom:18px;border-bottom:2.5px solid #0c3b82}
.ls-wordmark{display:flex;flex-direction:column;gap:1px}
.ls-wm1{font-size:14pt;font-weight:800;color:#0c3b82;letter-spacing:.12em;text-transform:uppercase;line-height:1}
.ls-wm2{font-size:6.5pt;color:#6b7280;letter-spacing:.22em;text-transform:uppercase;font-weight:500}
.ev-info{text-align:right}
.ev-title{font-size:12pt;font-weight:700;color:#0c3b82;line-height:1.2}
.ev-sub{font-size:8.5pt;color:#6b7280;margin-top:3px;line-height:1.4}
/* Entity title */
h1{font-size:17pt;font-weight:800;color:#0c3b82;margin:0 0 3px;letter-spacing:-.01em}
h2{font-size:9.5pt;color:#6b7280;margin:0 0 16px;padding-bottom:9px;border-bottom:1px solid #e5e7eb;line-height:1.5}
/* Table */
table{width:100%;border-collapse:collapse;margin-bottom:14px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden}
.dh{background:#0c3b82;color:#fff;font-weight:700;padding:7px 12px;font-size:10pt;letter-spacing:.06em;text-transform:uppercase}
.th th{background:#1e5ab0;color:#fff;padding:5px 10px;text-align:left;font-size:8.5pt;letter-spacing:.05em;text-transform:uppercase;font-weight:600}
td{padding:7px 10px;border-bottom:1px solid #f3f4f6;vertical-align:top;font-size:10pt}
tr:last-child td{border-bottom:none}
.even td{background:#f9fafb}
.tt{font-weight:700;color:#0c3b82;white-space:nowrap;width:68px;font-size:10.5pt}
.co-name{font-weight:700;font-size:10.5pt;color:#111827}
.co-tick{display:inline-block;font-size:8pt;font-weight:600;color:#fff;background:#1e5ab0;padding:1px 5px;border-radius:3px;margin-left:4px;vertical-align:middle}
.reps{font-size:9pt;color:#4b5563;margin-top:2px;line-height:1.4}
/* Footer */
.page-footer{margin-top:18px;padding-top:10px;border-top:1.5px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;font-size:8pt;color:#9ca3af}
.footer-brand{font-weight:700;color:#0c3b82;letter-spacing:.08em;text-transform:uppercase}
/* Print */
@media print{
  body{padding:0}
  .page+.page{page-break-before:always}
  .dh,.th th{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .even td{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .co-tick{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
${(()=>{
  return entities.flatMap((e,ei)=>{
    return e.sections.map((sec,si)=>{
      const isFirstPage=ei===0&&si===0;
      const isLastPage=ei===entities.length-1&&si===e.sections.length-1;
      // Rows
      const rowsHtml=sec.rows.map((r,i)=>{
        const st=r.col5||r.col4||"";
        const typ=r.col3||"";
        const loc=r.col4||(r.col5?"":r.col3)||"";
        const typClr=typeClr(typ);
        return `<tr class="${i%2===0?"even":""}">
          <td class="tt">${esc(r.time)||""}</td>
          <td><div class="co-name">${esc(r.col1)}${r.col1b?`<span class="co-tick">${esc(r.col1b)}</span>`:""}</div>${r.reps||r.col2?`<div class="reps">${esc(r.reps||r.col2)}</div>`:""}</td>
          <td style="font-size:9pt;color:${typClr};font-weight:600;white-space:nowrap">${esc(typ)}</td>
          <td style="font-size:9.5pt;color:#374151">${esc(loc)}</td>
          <td style="width:110px">${stBadge(st)}</td>
        </tr>`;
      }).join("");
      // Footer
      const footerHtml=`<div class="page-footer">
        <div><span class="footer-brand">Latin Securities</span> &nbsp;·&nbsp; Confidential — prepared for ${esc(e.name)}</div>
        <div>Page ${si+1} of ${e.sections.length}</div>
      </div>`;
      // Contacts strip (last page only)
      const contactsHtml=isLastPage&&(meta.contacts||[]).length?`<div style="margin-top:14px;padding:10px 14px;border-top:2px solid #0c3b82;font-size:8.5pt;color:#374151;display:flex;align-items:center;flex-wrap:wrap;gap:10px"><strong style="color:#0c3b82;margin-right:6px">LS Contact:</strong>${(meta.contacts||[]).map(c=>`${esc(c.name)}${c.role?" · "+esc(c.role):""}${c.email?" · "+esc(c.email):""}${c.phone?" · "+esc(c.phone):""}`).join(" &nbsp;|&nbsp; ")}</div>`:"";
      return `<div class="page">
        <div class="ls-hdr">
          <img src="data:image/png;base64,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" style="height:40px;display:block;" alt="Latin Securities"/>
          <div class="ev-info"><div class="ev-title">${esc(meta.eventTitle||"LS Roadshow")}</div><div class="ev-sub">${esc(meta.eventType||"")}${meta.eventDates?" &nbsp;·&nbsp; "+esc(meta.eventDates):""}</div></div>
        </div>
        ${isFirstPage?`<h1>${esc(e.name)}</h1><h2>${esc(e.sub)}</h2>`:""}
        <table>
          <tr><td colspan="5" class="dh">${esc(sec.dayLabel)}</td></tr>
          <tr class="th"><th>Time</th><th>Company / Meeting</th><th>Type</th><th>Location</th><th>Status</th></tr>
          ${rowsHtml}
        </table>
        ${contactsHtml}
        ${footerHtml}
      </div>`;
    });
  }).join("");
})()}
</body></html>`;
}

export function companyToEntity(co,meetings,investors,cfg){
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
export function investorToEntity(inv,meetings,companies,cfg,investors){
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

