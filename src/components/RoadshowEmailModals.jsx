// ── RoadshowEmailModals.jsx — Agenda & Daily Briefing email modals ──
// Extracted from src/roadshow.jsx so they no longer ship in the main bundle.
// Both components compose an investor-facing email (plain text + HTML), let
// the user preview it, copy it, open it in Mail, or send via Resend.
// Consumed exclusively from RoadshowInboundTab.jsx via React.lazy().
import { useState } from "react";
import { esc, safeUrl } from "../storage.jsx";
import { PLATFORM_LABELS, stripNeighborhood } from "../travel.js";
import {
  fmtHourInTZ, dateInTZ, TIMEZONES, BASE_TZ, tzOffsetLabel,
  joinNames, fmtDateRange,
} from "../roadshow.jsx";

/* ─── Roadshow Agenda Email Modal ───────────────────────────────── */
export function RoadshowAgendaEmailModal({roadshow, rsCos, tripDays, lsContact, onClose, resendKey:resendKeyProp}){
  const[copied,setCopied]=useState(false);
  const[fmt,setFmt]=useState("text"); // "text" | "html"
  const[sending,setSending]=useState(false);
  const[sendResult,setSendResult]=useState(null); // null | "ok" | "err:<msg>"
  const[tz,setTz]=useState(BASE_TZ); // selected timezone for time rendering
  const isOtherTz=tz!==BASE_TZ;
  const tzLabel=(TIMEZONES.find(t=>t.value===tz)?.label||tz);
  const tzOffset=tzOffsetLabel(tz);
  const rm=new Map((rsCos||[]).map(c=>[c.id,c]));
  const{trip,meetings}=roadshow;
  // fmtH now is tz-aware. When tz === BA we keep the original cheap formatter.
  const fmtH=(h,date)=>fmtHourInTZ(date,h,tz);
  const fmtDay=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const fmtShort=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"});
  // Group by date IN TARGET TZ (handles meetings that cross midnight when shifted).
  // For BA tz this is identical to grouping by m.date.
  const byDay={};(meetings||[]).filter(m=>m.status!=="cancelled").forEach(m=>{
    const d=isOtherTz?dateInTZ(m.date,m.hour,tz):m.date;
    if(!byDay[d])byDay[d]=[];byDay[d].push(m);
  });
  // Sort each day by the actual instant in target TZ (using the "HH:mm" string is enough
  // since dates within a single group share the same calendar day in target tz).
  Object.values(byDay).forEach(arr=>arr.sort((a,b)=>{
    const ta=fmtHourInTZ(a.date,a.hour,tz), tb=fmtHourInTZ(b.date,b.hour,tz);
    return ta.localeCompare(tb);
  }));
  const days=Object.keys(byDay).sort();
  const fund=trip.fund||(trip.clientName?"":"")||"";
  const client=trip.clientName||fund||"[Client]";
  const visitors=(trip.visitors||[]).filter(v=>v.name);
  const firstNames=visitors.map(v=>v.name.split(" ")[0]);
  const greeting=firstNames.length>0?`Dear ${joinNames(firstNames)},`:"Dear [Name],";
  const visitorsFull=visitors.map(v=>v.name+(v.title?` (${v.title})`:""));
  const dateRangeStr=fmtDateRange(trip.arrivalDate||"2026-04-18",trip.departureDate||"2026-04-24",{locale:"en-US",short:false});
  const oneDayTrip=trip.arrivalDate&&trip.departureDate&&trip.arrivalDate===trip.departureDate;

  // Build plain text agenda
  const textLines=[greeting,"",
    `Please find below your confirmed meeting schedule for ${oneDayTrip?"":"your "}Buenos Aires visit${oneDayTrip?" on":","} ${dateRangeStr}.`,""
  ];
  if(visitorsFull.length>1) textLines.push(`On behalf of ${fund||"the team"}: ${joinNames(visitorsFull)}.`,"");
  if(isOtherTz) textLines.push(`⏰ All times below are shown in ${tzLabel.replace(/^[^ ]+ /,'')}${tzOffset?` (${tzOffset})`:""}.`,"");
  days.forEach(date=>{
    textLines.push(`── ${fmtDay(date).toUpperCase()} ──`,"");
    byDay[date].forEach(m=>{
      const co=m.type==="company"?rm.get(m.companyId):null;
      const isVirt=m.location==="virtual";
      const locL=isVirt?(PLATFORM_LABELS[m.meetingPlatform]||"Virtual meeting"):m.location==="ls_office"?(trip.officeAddress||"Arenales 707, 6° Piso, CABA"):m.location==="hq"?(co?stripNeighborhood(co.hqAddress)||co.name+" HQ":"Company HQ"):stripNeighborhood(m.locationCustom||"TBD");
      // Per-meeting attendees (company reps OR free-text participants)
      const reps=(()=>{
        if(m.type==="company"){
          const allR=co?.contacts||[];
          const sel=m.attendeeIds?.length?allR.filter(r=>m.attendeeIds.includes(r.id)):allR;
          return sel.filter(r=>r.name).map(r=>r.name+(r.title?` (${r.title})`:"")).join(", ");
        }
        return m.participants||"";
      })();
      textLines.push(`  ${fmtH(m.hour,m.date)}   ${co?co.name:(m.lsType||m.title||"Meeting")}${co?" ("+co.ticker+")":""}`);
      textLines.push(`         ${isVirt?"💻":"📍"} ${locL}`);
      if(isVirt&&m.meetingLink) textLines.push(`         🔗 ${m.meetingLink}`);
      if(reps) textLines.push(`         👤 ${reps}`);
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
      const isVirt=m.location==="virtual";
      const locL=isVirt?(PLATFORM_LABELS[m.meetingPlatform]||"Virtual meeting"):m.location==="ls_office"?`LS Offices`:m.location==="hq"?(co?co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
      const reps=(()=>{const allR=co?.contacts||[];const sel=m.attendeeIds?.length?allR.filter(r=>m.attendeeIds.includes(r.id)):allR;return sel.filter(r=>r.name);})();
      // Escape every interpolation — this HTML is sent to investor mailboxes via Resend.
      const safeLink=safeUrl(m.meetingLink);
      const linkLine=isVirt&&safeLink?`<br/><a href="${esc(safeLink)}" style="font-size:11px;color:#1e5ab0;text-decoration:underline;font-family:monospace;word-break:break-all">🔗 Join meeting</a>`:"";
      return `<tr style="border-bottom:1px solid #eef2f8"><td style="padding:8px 12px;font-family:monospace;font-weight:700;color:#1e5ab0;white-space:nowrap">${esc(fmtH(m.hour,m.date))}</td><td style="padding:8px 12px"><strong style="color:#000039">${esc(co?co.name:(m.lsType||m.title||"Meeting"))}</strong>${co&&co.ticker?` <span style="background:#3399ff;color:#fff;font-size:10px;padding:1px 5px;border-radius:3px;font-family:monospace">${esc(co.ticker)}</span>`:""}<br/><span style="font-size:11px;color:#7a8fa8">${isVirt?"💻":"📍"} ${esc(locL)}</span>${linkLine}${reps.length?`<br/><span style="font-size:11px;color:#555">👤 ${reps.map(r=>esc(r.name)+(r.title?` (${esc(r.title)})`:"")).join(", ")}</span>`:""}${m.notes?`<br/><span style="font-size:11px;color:#555;font-style:italic">📝 ${esc(m.notes)}</span>`:""}</td></tr>`;
    }).join("");
    return `<tr><td colspan="2" style="padding:10px 12px;background:#000039;color:#fff;font-weight:700;font-size:13px;letter-spacing:.04em">${esc(fmtDay(date))}</td></tr>${dayRows}`;
  }).join("");

  const tzBanner=isOtherTz?`<p style="margin-bottom:14px;padding:8px 12px;background:#eff6ff;border-left:3px solid #3399ff;border-radius:4px;font-size:12px;color:#1e5ab0">⏰ <strong>All times below shown in ${tzLabel.replace(/^[^ ]+ /,'')}${tzOffset?` (${tzOffset})`:""}.</strong></p>`:"";
  const htmlBody=`<div style="font-family:Calibri,Arial,sans-serif;max-width:600px;color:#1a2a3a">
<p style="margin-bottom:12px">${esc(greeting)}</p>
<p style="margin-bottom:8px">Please find below your confirmed meeting schedule for ${oneDayTrip?"":"your "}Buenos Aires visit${oneDayTrip?" on":","} <strong>${esc(fmtDateRange(trip.arrivalDate||"2026-04-18",trip.departureDate||"2026-04-24",{locale:"en-US",short:true}))}</strong>.</p>${visitorsFull.length>1?`<p style="margin-bottom:16px;font-size:13px;color:#5a6a7a">On behalf of <strong>${esc(fund||"the team")}</strong>: ${esc(joinNames(visitorsFull))}.</p>`:'<p style="margin-bottom:16px"></p>'}${tzBanner}
<table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #dde">${htmlRows}</table>
<p style="margin-bottom:4px">Should you need to make any changes, please don't hesitate to reach out.</p>
<p style="margin-top:20px">Best regards,<br/><strong>${esc(lsContact?.name||"[LS Contact]")}</strong><br/>${esc(lsContact?.role||"Institutional Sales")}<br/>Latin Securities${lsContact?.email?`<br/>${esc(lsContact.email)}`:""}</p>
</div>`;

  const toAddrs=visitors.filter(v=>v.email).map(v=>v.email).join(", ");
  const tzSubjectSuffix=isOtherTz?` · times in ${(TIMEZONES.find(t=>t.value===tz)?.short||"local")}`:"";
  const subject=`Buenos Aires Meeting Schedule — ${fund||client} | ${fmtDateRange(trip.arrivalDate||"",trip.departureDate||"",{locale:"en-US",short:true})}${tzSubjectSuffix}`;

  function copyText(){navigator.clipboard.writeText(textBody).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}).catch(()=>{const w=window.open("","_blank","width=680,height=560");w.document.write("<pre style='font:13px monospace;padding:20px;white-space:pre-wrap'>"+esc(textBody)+"</pre>");w.document.close();});}
  function openMail(){window.location.href=`mailto:${encodeURIComponent(toAddrs)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody)}`;}

  // Per-user key — passed in from the caller (App.jsx reads from AuthContext).
  // Falls back to legacy roadshow.trip.resendKey for unmigrated events; the
  // boot-time migration will clear that field shortly after sign-in.
  const resendKey=resendKeyProp||roadshow.trip?.resendKey||"";
  async function sendEmail(){
    if(!resendKey||!toAddrs){return;}
    setSending(true);setSendResult(null);
    try{
      // Resend requires a verified domain. Use lsContact email as reply-to.
      // If you have a verified domain, change "from" to match it.
      const senderName=lsContact?.name||"Latin Securities";
      const senderEmail=lsContact?.email||"";
      // Only send from the verified LS domain — the resend.dev test sender lands
      // in spam and looks unserious in front of an IR team.
      if(!senderEmail.includes("latinsecurities")){
        setSending(false);setSendResult("err:Configurá tu email @latinsecurities en Config → Contactos LS antes de enviar.");
        return;
      }
      const from=`${senderName} <${senderEmail}>`;
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
          {/* Timezone selector — convert times for investors in other zones */}
          <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-end"}}>
            <div style={{flex:1}}>
              <div className="lbl" style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                🕐 Zona horaria de la agenda
                {isOtherTz&&<span style={{fontSize:9,color:"var(--gold)",fontWeight:400}}>· se convierte desde BA automáticamente</span>}
              </div>
              <select className="sel" value={tz} onChange={e=>setTz(e.target.value)}>
                {TIMEZONES.map(t=>(<option key={t.value} value={t.value}>{t.label}{t.value!==BASE_TZ?" ("+tzOffsetLabel(t.value)+")":""}</option>))}
              </select>
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

/* ─── Daily Briefing Email Modal ─────────────────────────────────── */
export function DailyBriefingEmailModal({roadshow, rsCos, tripDays, lsContact, onClose, resendKey:resendKeyProp}){
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
  const[tz,setTz]=useState(BASE_TZ);
  const isOtherTz=tz!==BASE_TZ;
  const tzLabel=(TIMEZONES.find(t=>t.value===tz)?.label||tz);
  const tzOffset=tzOffsetLabel(tz);

  const fmtH=(h,date)=>fmtHourInTZ(date,h,tz);
  const fmtLong=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const fmtShort=iso=>new Date(iso+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});

  const dayMtgs=(meetings||[]).filter(m=>m.date===selDay&&m.status!=="cancelled").sort((a,b)=>a.hour-b.hour);
  const visitors=(trip.visitors||[]).filter(v=>v.name);
  const firstNames=visitors.map(v=>v.name.split(" ")[0]);
  const greeting=firstNames.length>0?`Good morning ${joinNames(firstNames)},`:"Good morning,";
  const fund=trip.fund||(trip.clientName||"[Client]");
  const hotel=trip.hotel;

  // Plain text
  const lines=[
    greeting,"",
    `Here is your schedule for ${selDay?fmtLong(selDay):"today"}${hotel?`, as a reminder you are staying at ${hotel}`:""}.`,""
  ];
  if(isOtherTz) lines.push(`⏰ Times shown in ${tzLabel.replace(/^[^ ]+ /,'')}${tzOffset?` (${tzOffset})`:""}.`,"");
  dayMtgs.forEach(m=>{
    const co=m.type==="company"?rm.get(m.companyId):null;
    const name=co?co.name:(m.lsType||m.title||"Meeting");
    const ticker=co?.ticker?` (${co.ticker})`:"";
    const dur=m.duration||trip.meetingDuration||60;
    const endH=m.hour+dur/60;
    const isVirt=m.location==="virtual";
    const rawLoc=isVirt?(PLATFORM_LABELS[m.meetingPlatform]||"Virtual meeting"):m.location==="ls_office"?(trip.officeAddress||"Arenales 707, 6° Piso, CABA"):m.location==="hq"?(co?co.hqAddress||co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
    const locL=isVirt?rawLoc:stripNeighborhood(rawLoc);
    const reps=(()=>{
      if(m.type!=="company") return m.participants||"";
      const allR=rm.get(m.companyId)?.contacts||[];
      const sel=m.attendeeIds?.length?allR.filter(r=>m.attendeeIds.includes(r.id)):allR;
      return sel.filter(r=>r.name).map(r=>r.name+(r.title?` (${r.title})`:"")+( r.phone?` · ${r.phone}`:"")+( r.email?` · ${r.email}`:"")).join("\n              ");
    })();
    lines.push(`  ${fmtH(m.hour,m.date)} – ${fmtH(endH,m.date)}   ${name}${ticker}`);
    lines.push(`                ${isVirt?"💻":"📍"} ${locL}`);
    if(isVirt&&m.meetingLink) lines.push(`                🔗 ${m.meetingLink}`);
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
    const isVirt=m.location==="virtual";
    const rawLoc=isVirt?(PLATFORM_LABELS[m.meetingPlatform]||"Virtual meeting"):m.location==="ls_office"?(trip.officeAddress||"Arenales 707, 6° Piso, CABA"):m.location==="hq"?(co?co.hqAddress||co.name+" HQ":"Company HQ"):(m.locationCustom||"TBD");
    const locL=isVirt?rawLoc:stripNeighborhood(rawLoc);
    // Escape every interpolation — this HTML is sent to investor mailboxes via Resend.
    const safeLink=safeUrl(m.meetingLink);
    const linkLine=isVirt&&safeLink?`<div style="font-size:12px;margin-top:2px"><a href="${esc(safeLink)}" style="color:#1e5ab0;text-decoration:underline">🔗 Join meeting</a></div>`:"";
    const reps=(()=>{
      if(m.type!=="company") return esc(m.participants||"");
      const allR=rm.get(m.companyId)?.contacts||[];
      const sel=m.attendeeIds?.length?allR.filter(r=>m.attendeeIds.includes(r.id)):allR;
      return sel.filter(r=>r.name).map(r=>`${esc(r.name)}${r.title?` <span style="color:#7a8fa8;font-size:11px">(${esc(r.title)})</span>`:""}`).join(", ");
    })();
    return `<tr style="border-bottom:1px solid #eef2f8">
      <td style="padding:10px 14px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:#1e5ab0;white-space:nowrap;vertical-align:top;font-weight:700">${esc(fmtH(m.hour,m.date))}<br/><span style="font-size:10px;color:#aaa;font-weight:400">${esc(fmtH(endH,m.date))}</span></td>
      <td style="padding:10px 14px;vertical-align:top">
        <div style="font-weight:700;color:#000039;font-size:14px">${esc(name)}${co&&co.ticker?` <span style="background:#dde8f8;color:#1e5ab0;font-size:10px;padding:1px 5px;border-radius:3px;font-family:monospace">${esc(co.ticker)}</span>`:""}</div>
        <div style="font-size:12px;color:#555;margin-top:3px">${isVirt?"💻":"📍"} ${esc(locL)}</div>
        ${linkLine}
        ${reps?`<div style="font-size:12px;color:#555;margin-top:2px">👤 ${reps}</div>`:""}
        ${m.notes?`<div style="font-size:12px;color:#888;margin-top:2px;font-style:italic">📝 ${esc(m.notes)}</div>`:""}
      </td>
    </tr>`;
  }).join("");

  const tzBannerDB=isOtherTz?`<p style="margin-bottom:14px;padding:8px 12px;background:#eff6ff;border-left:3px solid #3399ff;border-radius:4px;font-size:12px;color:#1e5ab0">⏰ <strong>Times shown in ${tzLabel.replace(/^[^ ]+ /,'')}${tzOffset?` (${tzOffset})`:""}.</strong></p>`:"";
  const htmlBody=`<div style="font-family:Calibri,Arial,sans-serif;max-width:600px;color:#1a2a3a;line-height:1.6">
<p style="margin-bottom:12px">${esc(greeting)}</p>
<p style="margin-bottom:20px">Here is your schedule for <strong>${esc(selDay?fmtLong(selDay):"today")}</strong>${hotel?`, as a reminder you are staying at <strong>${esc(hotel)}</strong>`:""}.${!dayMtgs.length?" No meetings scheduled.":""}</p>${tzBannerDB}
${dayMtgs.length?`<table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #dde8f8;border-radius:8px;overflow:hidden">
  <tr><td colspan="2" style="background:#000039;color:#fff;padding:10px 14px;font-weight:700;letter-spacing:.04em">${esc(selDay?fmtLong(selDay):"")}</td></tr>
  ${mtgRows}
</table>`:""}
<p>Should you have any questions, please don't hesitate to reach out.</p>
<p style="margin-top:20px">Best regards,<br/><strong>${esc(lsContact?.name||"[LS Contact]")}</strong><br/>${esc(lsContact?.role||"Institutional Sales")}<br/>Latin Securities${lsContact?.email?`<br/>${esc(lsContact.email)}`:""}${lsContact?.phone?`<br/>${esc(lsContact.phone)}`:""}</p>
</div>`;

  const toAddrs=visitors.filter(v=>v.email).map(v=>v.email).join(", ");
  const subject=`${fund} · Buenos Aires – Daily Schedule – ${selDay?fmtShort(selDay):""}${isOtherTz?" · "+(TIMEZONES.find(t=>t.value===tz)?.short||"local"):""}`;
  const resendKey=resendKeyProp||trip?.resendKey||"";

  function copyText(){navigator.clipboard.writeText(textBody).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}).catch(()=>{const w=window.open("","_blank","width=680,height=560");w.document.write("<pre style='font:13px monospace;padding:20px;white-space:pre-wrap'>"+esc(textBody)+"</pre>");w.document.close();});}
  function openMail(){window.location.href=`mailto:${encodeURIComponent(toAddrs)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(textBody)}`;}

  async function sendEmail(){
    if(!resendKey||!toAddrs) return;
    setSending(true);setSendResult(null);
    try{
      const senderName=lsContact?.name||"Latin Securities";
      const senderEmail=lsContact?.email||"";
      if(!senderEmail.includes("latinsecurities")){
        setSending(false);setSendResult("err:Configurá tu email @latinsecurities en Config → Contactos LS antes de enviar.");
        return;
      }
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
          {/* Day + timezone selectors */}
          <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"flex-end",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:140}}>
              <div className="lbl">Día</div>
              <select className="sel" value={selDay} onChange={e=>setSelDay(e.target.value)}>
                {activeDays.map(d=>{
                  const n=(meetings||[]).filter(m=>m.date===d&&m.status!=="cancelled").length;
                  const label=new Date(d+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"});
                  return <option key={d} value={d}>{label}{n?` · ${n} mtg${n>1?"s":""}`:""}</option>;
                })}
              </select>
            </div>
            <div style={{flex:1.5,minWidth:200}}>
              <div className="lbl">🕐 Zona horaria</div>
              <select className="sel" value={tz} onChange={e=>setTz(e.target.value)}>
                {TIMEZONES.map(t=>(<option key={t.value} value={t.value}>{t.label}{t.value!==BASE_TZ?" ("+tzOffsetLabel(t.value)+")":""}</option>))}
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
