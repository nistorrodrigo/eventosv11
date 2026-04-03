// ── roadshow.js — roadshow constants, email generators, ICS ──
import { useState, useRef } from 'react';
import { stripNeighborhood } from './travel.js';
import { esc } from './storage.jsx';

/* ═══════════════════════════════════════════════════════════════════
   ROADSHOW SCHEDULER
═══════════════════════════════════════════════════════════════════ */
// Hours in 30-min increments: 8.0, 8.5, 9.0, ... 20.0
export const ROADSHOW_HOURS =Array.from({length:25},(_,i)=>8+i*0.5);
export function fmtHour(h){const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");}
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
export function genRSEmail(co,trip,meetings,lsContact,tripDays){
  const busy=new Set((meetings||[]).map(m=>`${m.date}-${m.hour}`));
  const workDays=(tripDays||[]).filter(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;});
  const free=[];
  for(const day of workDays){for(const h of[9,10,11,12,14,15,16,17]){if(!busy.has(`${day}-${h}`))free.push({day,h});}}
  const fmtD=iso=>{const s=new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});return s.charAt(0).toUpperCase()+s.slice(1);};
  const arr=fmtD(trip.arrivalDate||"2026-04-18");
  const dep=fmtD(trip.departureDate||"2026-04-24");
  const visitors=(trip.visitors||[]).filter(v=>v.name);
  const visNames=visitors.length>0?visitors.map(v=>v.name+(v.title?` (${v.title})`:"")):[(trip.clientName||"el cliente")];
  const cli=trip.fund?(trip.clientName?`${trip.fund} (${trip.clientName})`:`${trip.fund}`):(trip.clientName||"[cliente]");
  const visitorLine=visitors.length>1?`los siguientes representantes de ${cli}: ${visNames.join(", ")}`:`${visNames[0]} de ${cli}`;
  const loc=co.location==="ls_office"?`en nuestras oficinas (${trip.officeAddress||"Arenales 707, 6° Piso, CABA"})`:co.location==="hq"?`en la sede de ${co.name}`:`en ${co.locationCustom||"un lugar a coordinar"}`;
  const fmtHe=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
  const slots=free.slice(0,6).map(({day,h})=>`• ${fmtD(day)} a las ${fmtHe(h)} hs`).join("\n")||"• A coordinar según disponibilidad";
  const subj=`Solicitud de reunión – ${co.name} / ${trip.fund||trip.clientName||"[cliente]"} | Latin Securities`;
  const primaryContact=(co.contacts||[])[0];
  const body=`Estimado/a ${primaryContact?.name||co.contact?.name||"[Nombre del contacto]"},\n\nMe comunico desde Latin Securities para coordinar una reunión entre el equipo de ${co.name} y ${visitorLine||cli}, quienes estarán visitando Buenos Aires entre el ${arr} y el ${dep}, hospedándose en el ${trip.hotel||"[hotel]"}.\n\nNos gustaría solicitar una reunión de aproximadamente ${trip.meetingDuration||60} minutos. La misma podría realizarse ${loc}, según la conveniencia del equipo.\n\nLes proponemos los siguientes horarios disponibles:\n${slots}\n\nEn caso de preferir otro horario, quedamos totalmente disponibles para ajustar la agenda.\n\nMuchas gracias y saludos cordiales,\n\n${lsContact?.name||"[Nombre LS]"}\n${lsContact?.role||"Institutional Sales"}\nLatin Securities${lsContact?.email?"\n"+lsContact.email:""}${lsContact?.phone?" · "+lsContact.phone:""}`;
  return{to:primaryContact?.email||co.contact?.email||"",subject:subj,body};
}
export function rsToEntity(rs,rsCos){
  const{trip,meetings}=rs;
  const rm=new Map((rsCos||[]).map(c=>[c.id,c]));
  const byDay={};(meetings||[]).forEach(m=>{if(!byDay[m.date])byDay[m.date]=[];byDay[m.date].push(m);});
  Object.values(byDay).forEach(arr=>arr.sort((a,b)=>a.hour-b.hour));
  const days=Object.keys(byDay).sort();
  if(!days.length) return null;
  const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
  const fmtLong=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const fmtShort=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
  const visitors=(trip.visitors||[]).filter(v=>v.name);
  const visLine=visitors.length?visitors.map(v=>[v.name,v.title].filter(Boolean).join(" · ")).join(" | "):(trip.clientName||"");
  const sub=`${trip.fund||"Buenos Aires Roadshow"} · ${fmtShort(trip.arrivalDate||"2026-04-18")} – ${fmtShort(trip.departureDate||"2026-04-24")}${visLine?" · "+visLine:""}`;
  return{name:`${trip.clientName||"[Client]"}${trip.fund?" — "+trip.fund:""}`,sub,
    visitors:visitors.map(v=>v.name+(v.title?" · "+v.title:"")),
    sections:days.map(date=>({dayLabel:fmtLong(date),headerCols:["Time","Company / Meeting","Representatives","Type","Location","Status"],
    rows:byDay[date].map(m=>{const co=m.type==="company"?rm.get(m.companyId):null;
      const rawLoc=m.location==="ls_office"?(trip.officeAddress||"Arenales 707, 6° Piso, CABA"):m.location==="hq"?(co?co.hqAddress||co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
      const locL=stripNeighborhood(rawLoc);
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
      return{time:fmtH(m.hour),col1:col1Name,col1b:null,col1c:null,col1html:false,col1chtml:false,
        col2:reps||"",col2html:false,col3:fmt,col3html:false,col4:locL,col5:st};})
  }))};
}


/* ─── Roadshow Agenda Email Modal ───────────────────────────────── */
export function RoadshowAgendaEmailModal({roadshow, rsCos, tripDays, lsContact, onClose}){
  const[copied,setCopied]=useState(false);
  const[fmt,setFmt]=useState("text"); // "text" | "html"
  const[sending,setSending]=useState(false);
  const[sendResult,setSendResult]=useState(null); // null | "ok" | "err:<msg>"
  const rm=new Map((rsCos||[]).map(c=>[c.id,c]));
  const{trip,meetings}=roadshow;
  const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
  const fmtDay=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const fmtShort=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
  const byDay={};(meetings||[]).filter(m=>m.status!=="cancelled").forEach(m=>{if(!byDay[m.date])byDay[m.date]=[];byDay[m.date].push(m);});
  Object.values(byDay).forEach(arr=>arr.sort((a,b)=>a.hour-b.hour));
  const days=Object.keys(byDay).sort();
  const fund=trip.fund||(trip.clientName?"":"")||"";
  const client=trip.clientName||fund||"[Client]";
  const visitors=(trip.visitors||[]).filter(v=>v.name);
  const firstNames=visitors.map(v=>v.name.split(" ")[0]);
  const greeting=firstNames.length>0?`Dear ${firstNames.join(" and ")},`:"Dear [Name],";

  // Build plain text agenda
  const textLines=[greeting,"",
    `Please find below your confirmed meeting schedule for your Buenos Aires visit, ${new Date((trip.arrivalDate||"2026-04-18")+"T12:00:00").toLocaleDateString("en-US",{month:"long",day:"numeric"})}–${fmtShort(trip.departureDate||"2026-04-24")}.`,""
  ];
  days.forEach(date=>{
    textLines.push(`── ${fmtDay(date).toUpperCase()} ──`,"");
    byDay[date].forEach(m=>{
      const co=m.type==="company"?rm.get(m.companyId):null;
      const locL=m.location==="ls_office"?(trip.officeAddress||"Arenales 707, 6° Piso, CABA"):m.location==="hq"?(co?stripNeighborhood(co.hqAddress)||co.name+" HQ":"Company HQ"):stripNeighborhood(m.locationCustom||"TBD");
      textLines.push(`  ${fmtH(m.hour)}   ${co?co.name:(m.lsType||m.title||"Meeting")}${co?" ("+co.ticker+")":""}`);
      textLines.push(`         📍 ${locL}`);
      if(m.notes) textLines.push(`         📝 ${m.notes}`);
      textLines.push("");
    });
  });
  textLines.push("","Should you need to make any changes, please don't hesitate to reach out.","",
    `Best regards,`,"",lsContact?.name||"[LS Contact]",lsContact?.role||"Institutional Sales","Latin Securities",
    lsContact?.email||"",lsContact?.phone||""
  );
  const textBody=textLines.filter(l=>l!==undefined).join("\n");

  // HTML version
  const htmlRows=days.map(date=>{
    const dayRows=byDay[date].map(m=>{
      const co=m.type==="company"?rm.get(m.companyId):null;
      const locL=m.location==="ls_office"?`LS Offices`:m.location==="hq"?(co?co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
      const reps=(()=>{const allR=co?.contacts||[];const sel=m.attendeeIds?.length?allR.filter(r=>m.attendeeIds.includes(r.id)):allR;return sel.filter(r=>r.name);})();
      return `<tr style="border-bottom:1px solid #eef2f8"><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1e5ab0;white-space:nowrap">${fmtH(m.hour)}</td><td style="padding:8px 12px"><strong style="color:#000039">${co?co.name:(m.lsType||m.title||"Meeting")}</strong>${co?` <span style="background:#3399ff;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;font-family:monospace">${co.ticker}</span>`:""}<br/><span style="font-size:11px;color:#7a8fa8">📍 ${locL}</span>${reps.length?`<br/><span style="font-size:11px;color:#555">👤 ${reps.map(r=>r.name+(r.title?` (${r.title})`:"")).join(", ")}</span>`:""}${m.notes?`<br/><span style="font-size:11px;color:#555;font-style:italic">📝 ${m.notes}</span>`:""}</td></tr>`;
    }).join("");
    return `<tr><td colspan="2" style="padding:10px 12px;background:#000039;color:#fff;font-weight:700;font-size:13px;letter-spacing:.04em">${fmtDay(date)}</td></tr>${dayRows}`;
  }).join("");

  const htmlBody=`<div style="font-family:Calibri,Arial,sans-serif;max-width:600px;color:#1a2a3a">
<p style="margin-bottom:12px">${greeting}</p>
<p style="margin-bottom:16px">Please find below your confirmed meeting schedule for your Buenos Aires visit, <strong>${fmtShort(trip.arrivalDate||"2026-04-18")}–${fmtShort(trip.departureDate||"2026-04-24")}</strong>.</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #dde">${htmlRows}</table>
<p style="margin-bottom:4px">Should you need to make any changes, please don't hesitate to reach out.</p>
<p style="margin-top:20px">Best regards,<br/><strong>${lsContact?.name||"[LS Contact]"}</strong><br/>${lsContact?.role||"Institutional Sales"}<br/>Latin Securities${lsContact?.email?`<br/>${lsContact.email}`:""}</p>
</div>`;

  const toAddrs=visitors.filter(v=>v.email).map(v=>v.email).join(", ");
  const subject=`Buenos Aires Meeting Schedule — ${fund||client} | ${fmtShort(trip.arrivalDate||"")}–${fmtShort(trip.departureDate||"")}`;

  function copyText(){navigator.clipboard.writeText(textBody).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}).catch(()=>{const w=window.open("","_blank","width=680,height=560");w.document.write("<pre style='font:13px monospace;padding:20px;white-space:pre-wrap'>"+textBody+"</pre>");w.document.close();});}
  function openMail(){window.location.href=`mailto:${encodeURIComponent(toAddrs)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody)}`;}

  const resendKey=roadshow.trip?.resendKey||"";
  async function sendEmail(){
    if(!resendKey||!toAddrs){return;}
    setSending(true);setSendResult(null);
    try{
      // Resend requires a verified domain. Use lsContact email as reply-to.
      // If you have a verified domain, change "from" to match it.
      const senderName=lsContact?.name||"Latin Securities";
      const senderEmail=lsContact?.email||"onboarding@resend.dev";
      // For verified domain: use senderEmail. Fallback: onboarding@resend.dev (Resend test)
      const from=senderEmail.includes("resend.dev")||senderEmail.includes("latinsecurities.ar")
        ?`${senderName} <${senderEmail}>`
        :`Latin Securities LS <onboarding@resend.dev>`;
      const replyTo=lsContact?.email?[{email:lsContact.email,name:senderName}]:undefined;
      const res=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${resendKey}`},
        body:JSON.stringify({
          from,
          to:toAddrs.split(",").map(s=>s.trim()).filter(Boolean),
          reply_to:lsContact?.email||undefined,
          subject,
          html:htmlBody,
          text:textBody,
        })
      });
      const data=await res.json();
      if(res.ok) setSendResult("ok");
      else setSendResult("err:"+(data?.message||data?.error||"Error al enviar"));
    }catch(e){setSendResult("err:"+e.message);}
    setSending(false);
  }

  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:680,maxHeight:"90vh",display:"flex",flexDirection:"column"}}>
        <div className="modal-hdr"><div className="modal-title">📧 Agenda para el inversor</div></div>
        <div className="modal-body" style={{flex:1,overflowY:"auto"}}>
          {/* Header info */}
          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200}}>
              <div className="lbl">Para</div>
              <div style={{fontSize:12,color:toAddrs?"var(--txt)":"var(--red)",background:"var(--ink3)",padding:"5px 10px",borderRadius:5,fontFamily:"IBM Plex Mono,monospace"}}>
                {toAddrs||"⚠ Agregá emails en 🧳 Datos del Viaje → Visitantes"}
              </div>
            </div>
            <div style={{flex:2,minWidth:220}}>
              <div className="lbl">Asunto</div>
              <div style={{fontSize:12,color:"var(--cream)",background:"var(--ink3)",padding:"5px 10px",borderRadius:5,fontWeight:600}}>{subject}</div>
            </div>
          </div>
          {/* Format toggle */}
          <div style={{display:"flex",gap:5,marginBottom:10}}>
            {[["text","📄 Texto plano"],["html","🌐 Vista HTML"]].map(([v,l])=>(
              <button key={v} className={`btn bs ${fmt===v?"bg":"bo"}`} style={{fontSize:10}} onClick={()=>setFmt(v)}>{l}</button>
            ))}
          </div>
          {/* Preview */}
          {fmt==="text"&&(
            <pre style={{fontFamily:"Calibri,Georgia,serif",fontSize:12,color:"var(--txt)",background:"var(--ink3)",padding:"12px 14px",borderRadius:6,whiteSpace:"pre-wrap",maxHeight:360,overflowY:"auto",lineHeight:1.75}}>{textBody}</pre>
          )}
          {fmt==="html"&&(
            <div style={{background:"#fff",padding:"16px",borderRadius:6,border:"1px solid rgba(30,90,176,.12)",maxHeight:360,overflowY:"auto"}} dangerouslySetInnerHTML={{__html:htmlBody}}/>
          )}
          {days.length===0&&<div style={{fontSize:12,color:"var(--red)",marginTop:8}}>⚠ No hay reuniones cargadas. Agregá reuniones en la tab 📅 Agenda primero.</div>}
        </div>
        {sendResult&&(
          <div style={{padding:"6px 20px",fontSize:12,
            color:sendResult==="ok"?"#166534":"#991b1b",
            background:sendResult==="ok"?"#dcfce7":"#fee2e2",
            borderTop:"1px solid",borderColor:sendResult==="ok"?"#86efac":"#fca5a5"}}>
            {sendResult==="ok"?"✅ Email enviado correctamente.":"❌ "+sendResult.replace("err:","")}
          </div>
        )}
        <div className="modal-footer" style={{gap:7}}>
          <button className="btn bo bs" onClick={onClose}>Cerrar</button>
          <button className="btn bo bs" onClick={openMail} disabled={!toAddrs}>📧 Abrir en Mail</button>
          <button className={`btn bs ${copied?"bo":"bg"}`} onClick={copyText}>{copied?"✅ ¡Copiado!":"📋 Copiar texto"}</button>
          {resendKey&&(
            <button className="btn bg bs" style={{gap:5,background:sending?"#555":undefined}}
              onClick={sendEmail} disabled={sending||!toAddrs||days.length===0}>
              {sending?"⏳ Enviando...":"🚀 Enviar email"}
            </button>
          )}
          {!resendKey&&(
            <button className="btn bo bs" style={{opacity:.5,cursor:"default"}} title="Configurá la Resend API Key en 🧳 Datos del Viaje">
              🚀 Enviar (sin key)
            </button>
          )}
        </div>
      </div>
    </div>
  );
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
    events.push({uid,title:summary,date:start.date,hour:Math.round(start.hour),
      duration:durMin,locationCustom:location,notes:desc.slice(0,300)});
  });
  return events;
}

/* ─── ICS Calendar Export ─────────────────────────────────────── */
export function buildICS(meetings, companies, trip){
  const rsCoMap=new Map((companies||[]).map(c=>[c.id,c]));
  const pad=n=>String(n).padStart(2,"0");
  const fmtNow=()=>{const n=new Date();return n.getUTCFullYear()+pad(n.getUTCMonth()+1)+pad(n.getUTCDate())+"T"+pad(n.getUTCHours())+pad(n.getUTCMinutes())+pad(n.getUTCSeconds())+"Z";};
  const fmtDT=(dateStr,hour)=>{
    const d=new Date(dateStr+"T"+pad(hour)+":00:00");
    return d.getUTCFullYear()+pad(d.getUTCMonth()+1)+pad(d.getUTCDate())+"T"+pad(d.getUTCHours())+pad(d.getUTCMinutes())+"00Z";
  };
  const esc=s=>(s||"").replace(/[\,;]/g,"\\$&").replace(/\n/g,"\\n");
  const dur=trip.meetingDuration||60;
  const events=meetings.filter(m=>m.status!=="cancelled").map(m=>{
    const co=m.type==="company"?rsCoMap.get(m.companyId):null;
    const title=co?`${co.name} / ${trip.fund||trip.clientName||"Roadshow"}`:(m.lsType||m.title||"Internal Meeting");
    const locL=m.location==="ls_office"?(trip.officeAddress||"LS Offices"):m.location==="hq"?(co?co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
    const start=fmtDT(m.date,m.hour);
    const endHour=m.hour+Math.floor(dur/60);const endMin=dur%60;
    const d=new Date(m.date+"T"+pad(m.hour)+":00:00");
    const endD=new Date(d.getTime()+dur*60000);
    const endDT=endD.getUTCFullYear()+pad(endD.getUTCMonth()+1)+pad(endD.getUTCDate())+"T"+pad(endD.getUTCHours())+pad(endD.getUTCMinutes())+"00Z";
    const uid=`rs-${m.id}@latinsecurities.ar`;
    const attendees=(trip.visitors||[]).filter(v=>v.email).map(v=>`ATTENDEE;CN="${esc(v.name)}":mailto:${v.email}`).join("\r\n");
    // Use meeting-specific selected reps, fall back to all contacts
    const allCoContacts=co?.contacts||[];
    const selIds=m.attendeeIds||[];
    const mtgReps=selIds.length>0?allCoContacts.filter(r=>selIds.includes(r.id)):allCoContacts;
    const coContactLines=mtgReps.filter(r=>r.email).map(r=>`ATTENDEE;CN="${esc(r.name)}":mailto:${r.email}`).join("\r\n");
    const coContact=coContactLines||( co?.contact?.email?`ATTENDEE;CN="${esc(co.contact?.name||co.name)}":mailto:${co.contact.email}`:"");
    const seq=m.icsVersion||0;
    return `BEGIN:VEVENT\r\nUID:${uid}\r\nSEQUENCE:${seq}\r\nDTSTAMP:${fmtNow()}\r\nLAST-MODIFIED:${fmtNow()}\r\nDTSTART:${start}\r\nDTEND:${endDT}\r\nSUMMARY:${esc(title)}\r\nLOCATION:${esc(locL)}\r\nDESCRIPTION:${esc((co?.notes||"")+( m.notes?("\n"+m.notes):""))}\r\n${attendees?attendees+"\r\n":""}${coContact?coContact+"\r\n":""}END:VEVENT`;
  });
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Latin Securities//Roadshow//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:REQUEST\r\n${events.join("\r\n")}\r\nEND:VCALENDAR`;
}

/* ─── Booking Page HTML Generator ───────────────────────────────── */
export function buildBookingPage(trip, companies, meetings, officeAddress){
  const busySlots=new Set((meetings||[]).map(m=>`${m.date}-${m.hour}`));
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
      if(!busySlots.has(`${day}-${h}`)) slots.push({day,h});
    }
  }
  const fmtDay=iso=>new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
  const fund=trip.fund||trip.clientName||"Inversores";
  const slotList=slots.map(({day,h},i)=>`{id:"${day}-${h}",day:"${fmtDay(day)}",hour:${h}}`).join(",");
  
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Solicitar horario — ${fund} | Latin Securities</title>
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
<div class="hdr"><h1>📅 Solicitar horario de reunión</h1><p>${fund} · Buenos Aires · ${trip.arrivalDate||""} – ${trip.departureDate||""}</p></div>
<div class="card"><h2>Seleccioná un horario disponible</h2>
<div id="slotContainer"></div></div>
<div class="card" id="formCard" style="display:none"><h2>Tus datos</h2>
<div class="form-row"><label>Empresa *</label><input id="fCompany" placeholder="Nombre de la empresa"/></div>
<div class="form-row"><label>Nombre del representante *</label><input id="fName" placeholder="Juan Pérez"/></div>
<div class="form-row"><label>Email *</label><input id="fEmail" type="email" placeholder="jperez@empresa.com"/></div>
<div class="form-row"><label>Teléfono (opcional)</label><input id="fPhone" placeholder="+54 11..."/></div>
<div class="form-row"><label>Lugar de preferencia</label>
<select id="fLoc"><option value="ls_office">Oficinas Latin Securities (${officeAddress||"Arenales 707, 6° Piso, CABA"})</option><option value="hq">Nuestra sede / headquarters</option><option value="other">Otro (aclarar en notas)</option></select></div>
<div class="form-row"><label>Notas adicionales (opcional)</label><textarea id="fNotes" rows="2" placeholder="Asistentes, requerimientos especiales..."></textarea></div>
<button class="btn-submit" id="btnSubmit" onclick="submitBooking()">✓ Confirmar solicitud</button></div>
<div class="success" id="successBox"><h3>✅ Solicitud enviada</h3><p>Copiá el código de confirmación y enviáselo a Latin Securities:</p><div class="copy-box" id="confirmCode"></div></div>
</div>
<script>
const SLOTS=[${slotList}];
const FUND="${fund.replace(/"/g,"'")}";
let selectedSlot=null;
const taken=JSON.parse(localStorage.getItem("rs_taken_${trip.arrivalDate||''}${trip.departureDate||''}")||"{}");

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
  localStorage.setItem("rs_taken_${trip.arrivalDate||''}${trip.departureDate||''}",JSON.stringify(taken));
  const code=btoa(JSON.stringify({slot:selectedSlot.id,company:co,name,email,fund:FUND,loc:document.getElementById("fLoc").value,notes:document.getElementById("fNotes").value,ts:Date.now()}));
  document.getElementById("confirmCode").textContent=code;
  document.getElementById("successBox").style.display="block";
  document.getElementById("formCard").style.display="none";
  document.getElementById("btnSubmit").disabled=true;
  render();
}
render();
</script></body></html>`;
}



/* ─── Daily Briefing Email Modal ─────────────────────────────────── */
export function DailyBriefingEmailModal({roadshow, rsCos, tripDays, lsContact, onClose}){
  const rm=new Map((rsCos||[]).map(c=>[c.id,c]));
  const{trip,meetings}=roadshow;
  const activeDays=tripDays.filter(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;});
  // default: first day that has meetings, or first workday
  const daysWithMtgs=activeDays.filter(d=>(meetings||[]).some(m=>m.date===d&&m.status!=="cancelled"));
  const[selDay,setSelDay]=useState(daysWithMtgs[0]||activeDays[0]||"");
  const[copied,setCopied]=useState(false);
  const[fmt,setFmt]=useState("text");
  const[sending,setSending]=useState(false);
  const[sendResult,setSendResult]=useState(null);

  const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
  const fmtLong=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const fmtShort=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});

  const dayMtgs=(meetings||[]).filter(m=>m.date===selDay&&m.status!=="cancelled").sort((a,b)=>a.hour-b.hour);
  const visitors=(trip.visitors||[]).filter(v=>v.name);
  const firstNames=visitors.map(v=>v.name.split(" ")[0]);
  const greeting=firstNames.length>0?`Good morning ${firstNames.join(" and ")},`:"Good morning,";
  const fund=trip.fund||(trip.clientName||"[Client]");
  const hotel=trip.hotel;

  // Plain text
  const lines=[
    greeting,"",
    `Here is your schedule for ${selDay?fmtLong(selDay):"today"}${hotel?`, as a reminder you are staying at ${hotel}`:""}.`,""
  ];
  dayMtgs.forEach(m=>{
    const co=m.type==="company"?rm.get(m.companyId):null;
    const name=co?co.name:(m.lsType||m.title||"Meeting");
    const ticker=co?.ticker?` (${co.ticker})`:"";
    const dur=m.duration||trip.meetingDuration||60;
    const endH=m.hour+dur/60;
    const rawLoc=m.location==="ls_office"?(trip.officeAddress||"Arenales 707, 6° Piso, CABA"):m.location==="hq"?(co?co.hqAddress||co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
    const locL=stripNeighborhood(rawLoc);
    const reps=(()=>{
      if(m.type!=="company") return m.participants||"";
      const allR=rm.get(m.companyId)?.contacts||[];
      const sel=m.attendeeIds?.length?allR.filter(r=>m.attendeeIds.includes(r.id)):allR;
      return sel.filter(r=>r.name).map(r=>r.name+(r.title?` (${r.title})`:"")+( r.phone?` · ${r.phone}`:"")+( r.email?` · ${r.email}`:"")).join("\n              ");
    })();
    lines.push(`  ${fmtH(m.hour)} – ${fmtH(endH)}   ${name}${ticker}`);
    lines.push(`                📍 ${locL}`);
    if(reps) lines.push(`                👤 ${reps}`);
    if(m.notes) lines.push(`                📝 ${m.notes}`);
    lines.push("");
  });
  if(!dayMtgs.length) lines.push("  No meetings scheduled for this day.","");
  lines.push(
    "Should you have any questions, please don't hesitate to reach out.",
    "",
    "Best regards,","",
    lsContact?.name||"[LS Contact]",
    lsContact?.role||"Institutional Sales",
    "Latin Securities",
    lsContact?.email||"",lsContact?.phone||""
  );
  const textBody=lines.filter(l=>l!==undefined).join("\n");

  // HTML
  const mtgRows=dayMtgs.map(m=>{
    const co=m.type==="company"?rm.get(m.companyId):null;
    const name=co?co.name:(m.lsType||m.title||"Meeting");
    const dur=m.duration||trip.meetingDuration||60;
    const endH=m.hour+dur/60;
    const rawLoc=m.location==="ls_office"?(trip.officeAddress||"Arenales 707, 6° Piso, CABA"):m.location==="hq"?(co?co.hqAddress||co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
    const locL=stripNeighborhood(rawLoc);
    const reps=(()=>{
      if(m.type!=="company") return m.participants||"";
      const allR=rm.get(m.companyId)?.contacts||[];
      const sel=m.attendeeIds?.length?allR.filter(r=>m.attendeeIds.includes(r.id)):allR;
      return sel.filter(r=>r.name).map(r=>`${r.name}${r.title?` <span style="color:#7a8fa8;font-size:11px">(${r.title})</span>`:""}`).join(", ");
    })();
    return `<tr style="border-bottom:1px solid #eef2f8">
      <td style="padding:10px 14px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#1e5ab0;white-space:nowrap;vertical-align:top;font-weight:700">${fmtH(m.hour)}<br/><span style="font-size:10px;color:#aaa;font-weight:400">${fmtH(endH)}</span></td>
      <td style="padding:10px 14px;vertical-align:top">
        <div style="font-weight:700;color:#000039;font-size:14px">${name}${co?` <span style="background:#dde8f8;color:#1e5ab0;font-size:10px;padding:1px 5px;border-radius:3px;font-family:monospace">${co.ticker}</span>`:""}</div>
        <div style="font-size:12px;color:#555;margin-top:3px">📍 ${locL}</div>
        ${reps?`<div style="font-size:12px;color:#555;margin-top:2px">👤 ${reps}</div>`:""}
        ${m.notes?`<div style="font-size:12px;color:#888;margin-top:2px;font-style:italic">📝 ${m.notes}</div>`:""}
      </td>
    </tr>`;
  }).join("");

  const htmlBody=`<div style="font-family:Calibri,Arial,sans-serif;max-width:600px;color:#1a2a3a;line-height:1.6">
<p style="margin-bottom:12px">${greeting}</p>
<p style="margin-bottom:20px">Here is your schedule for <strong>${selDay?fmtLong(selDay):"today"}</strong>${hotel?`, as a reminder you are staying at <strong>${hotel}</strong>`:""}.${!dayMtgs.length?" No meetings scheduled.":""}</p>
${dayMtgs.length?`<table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #dde8f8;border-radius:8px;overflow:hidden">
  <tr><td colspan="2" style="background:#000039;color:#fff;padding:10px 14px;font-weight:700;letter-spacing:.04em">${selDay?fmtLong(selDay):""}</td></tr>
  ${mtgRows}
</table>`:""}
<p>Should you have any questions, please don't hesitate to reach out.</p>
<p style="margin-top:20px">Best regards,<br/><strong>${lsContact?.name||"[LS Contact]"}</strong><br/>${lsContact?.role||"Institutional Sales"}<br/>Latin Securities${lsContact?.email?`<br/>${lsContact.email}`:""}${lsContact?.phone?`<br/>${lsContact.phone}`:""}</p>
</div>`;

  const toAddrs=visitors.filter(v=>v.email).map(v=>v.email).join(", ");
  const subject=`${fund} · Buenos Aires – Daily Schedule – ${selDay?fmtShort(selDay):""}`;
  const resendKey=trip?.resendKey||"";

  function copyText(){navigator.clipboard.writeText(textBody).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}).catch(()=>{const w=window.open("","_blank","width=680,height=560");w.document.write("<pre style='font:13px monospace;padding:20px;white-space:pre-wrap'>"+textBody+"</pre>");w.document.close();});}
  function openMail(){window.location.href=`mailto:${encodeURIComponent(toAddrs)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody)}`;}

  async function sendEmail(){
    if(!resendKey||!toAddrs) return;
    setSending(true);setSendResult(null);
    try{
      const senderName=lsContact?.name||"Latin Securities";
      const senderEmail=lsContact?.email||"onboarding@resend.dev";
      const from=`${senderName} <${senderEmail}>`;
      const res=await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${resendKey}`},
        body:JSON.stringify({from,to:toAddrs.split(",").map(s=>s.trim()).filter(Boolean),reply_to:lsContact?.email||undefined,subject,html:htmlBody,text:textBody})
      });
      const data=await res.json();
      if(res.ok) setSendResult("ok");
      else setSendResult("err:"+(data?.message||data?.error||"Error"));
    }catch(e){setSendResult("err:"+e.message);}
    setSending(false);
  }

  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:680,maxHeight:"92vh",display:"flex",flexDirection:"column"}}>
        <div className="modal-hdr"><div className="modal-title">🌅 Agenda del día</div></div>
        <div className="modal-body" style={{flex:1,overflowY:"auto"}}>
          {/* Day selector */}
          <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"flex-end",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:180}}>
              <div className="lbl">Día</div>
              <select className="sel" value={selDay} onChange={e=>setSelDay(e.target.value)}>
                {activeDays.map(d=>{
                  const n=(meetings||[]).filter(m=>m.date===d&&m.status!=="cancelled").length;
                  const label=new Date(d+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"});
                  return <option key={d} value={d}>{label}{n?` · ${n} mtg${n>1?"s":""}`:""}</option>;
                })}
              </select>
            </div>
            <div style={{flex:2,minWidth:220}}>
              <div className="lbl">Para</div>
              <div style={{fontSize:12,color:toAddrs?"var(--txt)":"var(--red)",background:"var(--ink3)",padding:"5px 10px",borderRadius:5,fontFamily:"IBM Plex Mono,monospace"}}>
                {toAddrs||"⚠ Agregá emails en Datos del Viaje → Visitantes"}
              </div>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <div className="lbl">Asunto</div>
            <div style={{fontSize:12,color:"var(--cream)",background:"var(--ink3)",padding:"5px 10px",borderRadius:5,fontWeight:600}}>{subject}</div>
          </div>
          {/* Format toggle */}
          <div style={{display:"flex",gap:5,marginBottom:10}}>
            {[["text","📄 Texto plano"],["html","🌐 Vista HTML"]].map(([v,l])=>(
              <button key={v} className={`btn bs ${fmt===v?"bg":"bo"}`} style={{fontSize:10}} onClick={()=>setFmt(v)}>{l}</button>
            ))}
          </div>
          {fmt==="text"&&(
            <pre style={{fontFamily:"Calibri,Georgia,serif",fontSize:12,color:"var(--txt)",background:"var(--ink3)",padding:"12px 14px",borderRadius:6,whiteSpace:"pre-wrap",maxHeight:360,overflowY:"auto",lineHeight:1.75}}>{textBody}</pre>
          )}
          {fmt==="html"&&(
            <div style={{background:"#fff",padding:"16px",borderRadius:6,border:"1px solid rgba(30,90,176,.12)",maxHeight:360,overflowY:"auto"}} dangerouslySetInnerHTML={{__html:htmlBody}}/>
          )}
          {!hotel&&<div style={{fontSize:11,color:"var(--gold)",marginTop:8,padding:"4px 10px",background:"rgba(234,179,8,.08)",borderRadius:4}}>⚠ Hotel vacío — completalo en 🧳 Datos del Viaje para incluirlo en el email.</div>}
          {!toAddrs&&<div style={{fontSize:11,color:"var(--red)",marginTop:8}}>⚠ Sin emails de visitantes. Agregalos en 🧳 Datos del Viaje → Visitantes.</div>}
        </div>
        {sendResult&&(
          <div style={{padding:"6px 20px",fontSize:12,color:sendResult==="ok"?"#166534":"#991b1b",background:sendResult==="ok"?"#dcfce7":"#fee2e2",borderTop:"1px solid",borderColor:sendResult==="ok"?"#86efac":"#fca5a5"}}>
            {sendResult==="ok"?"✅ Email enviado correctamente.":"❌ "+sendResult.replace("err:","")}
          </div>
        )}
        <div className="modal-footer" style={{gap:7}}>
          <button className="btn bo bs" onClick={onClose}>Cerrar</button>
          <button className="btn bo bs" onClick={openMail} disabled={!toAddrs}>📧 Abrir en Mail</button>
          <button className={`btn bs ${copied?"bo":"bg"}`} onClick={copyText}>{copied?"✅ ¡Copiado!":"📋 Copiar texto"}</button>
          {resendKey?(
            <button className="btn bg bs" style={{gap:5,background:sending?"#555":undefined}} onClick={sendEmail} disabled={sending||!toAddrs}>
              {sending?"⏳ Enviando...":"🚀 Enviar email"}
            </button>
          ):(
            <button className="btn bo bs" style={{opacity:.5,cursor:"default"}} title="Configurá la Resend API Key en 🧳 Datos del Viaje">
              🚀 Enviar (sin key)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Travel Time & Maps Helpers ────────────────────────────────── */
