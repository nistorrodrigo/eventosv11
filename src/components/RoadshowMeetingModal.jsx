// ── RoadshowMeetingModal.jsx ──
import { useEffect, useRef, useState } from "react";
import { LS_INT_TYPES, ROADSHOW_HOURS, RS_CLR, fmtHour } from "../roadshow.jsx";
import { FeedbackWidget } from "./FeedbackWidget.jsx";

export function RoadshowMeetingModal({mode,date,hour,meeting,companies,trip,onSave,onDelete,onDuplicate,onExportICS,onClose}){
  const [type,setType]=useState(meeting?.type||"company");
  const [coId,setCoId]=useState(meeting?.companyId||"");
  const [lsType,setLsType]=useState(meeting?.lsType||LS_INT_TYPES[0]);
  const [title,setTitle]=useState(meeting?.title||"");
  const [selectedDate,setSelectedDate]=useState(meeting?.date||date||"");
  const [h,setH]=useState(String(meeting?.hour??hour??9));
  const [dur,setDur]=useState(String(meeting?.duration||60));
  const [loc,setLoc]=useState(meeting?.location||"ls_office");
  const [locCustom,setLocCustom]=useState(meeting?.locationCustom||"");
  const [status,setStatus]=useState(meeting?.status||"tentative");
  const [notes,setNotes]=useState(meeting?.notes||"");
  const [postNotes,setPostNotes]=useState(meeting?.postNotes||"");
  const [voiceNote,setVoiceNote]=useState(meeting?.voiceNote||null); // base64 audio
  const [recording,setRecording]=useState(false);
  const mediaRecRef=useRef(null);
  const chunksRef=useRef([]);
  const [actualReps,setActualReps]=useState(meeting?.actualAttendees||null); // null=not set, []|[ids]=checked
  const [changeNotif,setChangeNotif]=useState(null); // {msg,contact} after save
  const [meetingFormat,setMeetingFormat]=useState(meeting?.meetingFormat||"Meeting");
  const [participants,setParticipants]=useState(meeting?.participants||"");
  const [fullAddr,setFullAddr]=useState(meeting?.fullAddress||"");
  const d=new Date((date||"2026-04-20")+"T12:00:00");
  const dateLabel=d.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
  const [selReps,setSelReps]=useState(meeting?.attendeeIds||[]);
  const selCo=(companies||[]).find(c=>c.id===coId);
  const coContacts=selCo?.contacts||[];
  // Sync selReps when company changes - default select all
  useEffect(()=>{if(coId&&!meeting){setSelReps(((companies||[]).find(c=>c.id===coId)?.contacts||[]).map(r=>r.id));}else if(coId&&meeting){setSelReps(meeting.attendeeIds||[]);}}, [coId]); // eslint-disable-line
  function save(){
    if(type==="company"&&!coId){alert("Seleccioná una empresa.");return;}
    const prevM=meeting||{};
    const m={id:meeting?.id||`rsm-${Date.now()}`,date:selectedDate||date,hour:parseFloat(h),duration:parseInt(dur),type,
      companyId:type==="company"?coId:"",lsType:type==="ls_internal"?lsType:"",
      title:type==="custom"?title:type==="ls_internal"?lsType:"",
      location:loc,locationCustom:locCustom,status,notes,postNotes,voiceNote,actualAttendees:actualReps,meetingFormat,
      participants:type!=="company"?participants:"",
      fullAddress:fullAddr,
      attendeeIds:type==="company"?selReps:[],
      icsVersion:(()=>{
        const prev=prevM.icsVersion||0;
        const dateChg=String(prevM.date||'')!==(selectedDate||date);
        const hourChg=String(prevM.hour??'')!==String(parseFloat(h));
        const durChg=String(prevM.duration||60)!==String(parseInt(dur));
        const locChg=(prevM.location||'')!==loc||(prevM.locationCustom||'')!==locCustom;
        return (dateChg||hourChg||durChg||locChg)?prev+1:prev;
      })(),
      changeLog:(()=>{
        const now=new Date().toISOString(); const log=[...(prevM.changeLog||[])];
        const chk=(f,nv)=>{if(String(prevM[f]??'')!==String(nv??'')) log.push({at:now,field:f,from:prevM[f],to:nv});};
        chk('date',selectedDate||date);chk('hour',parseFloat(h));chk('duration',parseInt(dur));
        chk('status',status);chk('companyId',type==="company"?coId:'');
        return log;
      })()};
    // Detect time/date change for notification
    const dateChanged=String(prevM.date||'')!==String(m.date);
    const hourChanged=String(prevM.hour??'')!==String(m.hour);
    if(mode==='edit'&&(dateChanged||hourChanged)){
      const co=m.type==='company'?(companies||[]).find(c=>c.id===m.companyId):null;
      const contacts=(co?.contacts||[]).filter(c=>c.name);
      const selIds=m.attendeeIds||[];
      const mtgContacts=selIds.length?contacts.filter(c=>selIds.includes(c.id)):contacts.slice(0,1);
      const primaryContact=mtgContacts[0]||contacts[0];
      const fmtH=hv=>{const hh=Math.floor(hv);const mm=Math.round((hv-hh)*60);return String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');};
      const newDate=new Date(m.date+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
      const locStr=m.location==='ls_office'?(trip.officeAddress||'Arenales 707, 6° Piso, CABA'):m.location==='hq'?(co?co.hqAddress||co.name+' HQ':'HQ'):(m.locationCustom||'TBD');
      const fund=trip.fund||trip.clientName||'nuestro cliente';
      const visitorNames=(trip.visitors||[]).filter(v=>v.name).map(v=>v.name.split(' ')[0]).join(' y ')||fund;
      const coName=co?co.name:(m.lsType||m.title||'la reunión');
      const greeting=primaryContact?`Hola ${primaryContact.name.split(' ')[0]},`:'Hola,';
      const waMsg=`${greeting}

Les informamos que la reunión de ${visitorNames} (${fund}) con ${coName} ha sido *reprogramada*.

📅 *Nueva fecha:* ${newDate}
⏰ *Horario:* ${fmtH(m.hour)} hs
📍 *Lugar:* ${locStr}

Por favor confirmar recepción. Muchas gracias.

Saludos,
Latin Securities`;
      setChangeNotif({msg:waMsg,contact:primaryContact,coName});
    }
    onSave(m);
  }
  const actCos=(companies||[]).filter(c=>c.active);
  return(<>
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:460}}>
        <div className="modal-hdr"><div className="modal-title">{mode==="edit"?"Editar Reunión":"Nueva Reunión"}</div></div>
        <div className="modal-body">
          <div style={{marginBottom:12}}><div className="lbl">Día</div>
            <select className="sel" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}>
              {(()=>{
                if(!trip?.arrivalDate||!trip?.departureDate) return [<option key={selectedDate} value={selectedDate}>{selectedDate}</option>];
                const days=[];const s=new Date(trip.arrivalDate+"T12:00:00"),e=new Date(trip.departureDate+"T12:00:00");
                for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1)){
                  const iso=d.toISOString().slice(0,10);
                  const lbl=d.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
                  days.push(<option key={iso} value={iso}>{lbl.charAt(0).toUpperCase()+lbl.slice(1)}</option>);
                }
                return days;
              })()}
            </select></div>
          <div style={{marginBottom:12}}><div className="lbl">Tipo</div>
            <div style={{display:"flex",gap:5}}>
              {[["company","🏢 Empresa"],["ls_internal","🔵 LS Interno"],["custom","✏️ Otro"]].map(([v,l])=>(
                <button key={v} className={`btn bs ${type===v?"bg":"bo"}`} style={{fontSize:10,flex:1}} onClick={()=>setType(v)}>{l}</button>
              ))}
            </div></div>
          {type==="company"&&<div style={{marginBottom:12}}><div className="lbl">Empresa</div>
            <select className="sel" value={coId} onChange={e=>setCoId(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {actCos.map(c=><option key={c.id} value={c.id}>{c.name} ({c.ticker})</option>)}
            </select></div>}
          {type==="ls_internal"&&<div style={{marginBottom:12}}><div className="lbl">Reunión interna</div>
            <select className="sel" value={lsType} onChange={e=>setLsType(e.target.value)}>
              {LS_INT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select></div>}
          {type==="custom"&&<div style={{marginBottom:12}}><div className="lbl">Descripción</div>
            <input className="inp" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ej: Reunión con analista político..."/></div>}
          <div className="g2" style={{gap:10,marginBottom:12}}>
            <div><div className="lbl">Hora</div>
              <select className="sel" value={h} onChange={e=>setH(e.target.value)}>
                {ROADSHOW_HOURS.map(x=><option key={x} value={x}>{fmtHour(x)}</option>)}
              </select></div>
            <div><div className="lbl">Duración</div>
              <select className="sel" value={dur} onChange={e=>setDur(e.target.value)}>
                {[[30,"30 min"],[45,"45 min"],[60,"1 hora"],[90,"1h 30min"],[120,"2 horas"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select></div>
          </div>
          <div style={{marginBottom:12}}><div className="lbl">Lugar</div>
            <select className="sel" value={loc} onChange={e=>setLoc(e.target.value)}>
              <option value="ls_office">🏛 Nuestras oficinas (LS)</option>
              <option value="hq">🏢 Sede de la empresa</option>
              <option value="custom">📍 Otro lugar</option>
            </select>
            {loc==="custom"&&<input className="inp" style={{marginTop:5}} value={locCustom} onChange={e=>setLocCustom(e.target.value)} placeholder="Dirección o lugar..."/>}
            {loc==="hq"&&selCo&&(
              <input className="inp" style={{marginTop:5,fontSize:11}} value={selCo.hqAddress||""} placeholder={`Dirección HQ de ${selCo.name}...`}
                onChange={e=>{/* update company hqAddress inline */const patch=e.target.value;if(typeof window.__rsCoPatch==="function")window.__rsCoPatch(selCo.id,"hqAddress",patch);}}
              />
            )}
            <div style={{marginTop:5}}>
              <div className="lbl" style={{marginBottom:2,fontSize:9}}>Dirección completa</div>
              <input className="inp" style={{fontSize:11}} value={fullAddr} onChange={e=>setFullAddr(e.target.value)}
                placeholder={loc==="ls_office"?(trip?.officeAddress||"Arenales 707, 6° Piso, CABA"):loc==="hq"?(selCo?.hqAddress||"Dirección de la empresa..."):locCustom||"Dirección exacta..."}/>
            </div>
          </div>
          <div className="g2" style={{gap:10,marginBottom:12}}>
            <div><div className="lbl">Estado</div>
            <div style={{display:"flex",gap:5}}>
              {[["tentative","⏳ Tentativo"],["confirmed","✅ Confirmado"],["cancelled","❌ Cancelado"]].map(([v,l])=>(
                <button key={v} className={`btn bs ${status===v?"bg":"bo"}`} style={{fontSize:10,flex:1}} onClick={()=>setStatus(v)}>{l}</button>
              ))}
            </div></div>
            <div><div className="lbl">Formato</div>
              <select className="sel" value={meetingFormat} onChange={e=>setMeetingFormat(e.target.value)}>
                {["Meeting","Breakfast Meeting","Lunch","Dinner","Conference Call","Roadshow Presentation","Site Visit"].map(f=><option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          {meeting?.changeLog?.length>0&&(
            <details style={{marginBottom:10,background:"rgba(30,90,176,.04)",borderRadius:8,overflow:"hidden"}}>
              <summary style={{padding:"8px 12px",cursor:"pointer",fontSize:10,fontFamily:"IBM Plex Mono,monospace",color:"var(--gold)",fontWeight:600,letterSpacing:".04em",userSelect:"none",display:"flex",alignItems:"center",gap:6}}>
                🕐 Historial de cambios ({meeting.changeLog.length})
              </summary>
              <div style={{padding:"6px 12px 10px",maxHeight:200,overflowY:"auto"}}>
                {[...(meeting.changeLog||[])].reverse().map((c,i)=>{
                  const icons={moved:"🔄",status:"📌",location:"📍",hour:"⏰",date:"📅",created:"➕"};
                  const icon=icons[c.field]||"✏️";
                  const time=new Date(c.at);
                  const isRecent=Date.now()-time.getTime()<86400000;
                  return(
                    <div key={i} style={{display:"flex",gap:8,padding:"4px 0",borderBottom:i<meeting.changeLog.length-1?"1px solid rgba(30,90,176,.06)":"none"}}>
                      <div style={{width:2,background:isRecent?"#1e5ab0":"#d1d5db",borderRadius:2,flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:10,color:"var(--cream)"}}>{icon} <strong>{c.field}</strong>: {String(c.from??"-")} → {String(c.to??"-")}</div>
                        <div style={{fontSize:8,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace",marginTop:1}}>
                          {time.toLocaleDateString("es-AR",{day:"numeric",month:"short"})} {time.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}
                          {isRecent&&<span style={{marginLeft:6,color:"#1e5ab0",fontSize:7}}>● reciente</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
          <div style={{marginBottom:12}}><div className="lbl">Notas / Agenda</div>
            <textarea className="inp" style={{minHeight:54,resize:"vertical"}} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Temas a tratar, contexto, agenda..."/></div>
          {/* Post-meeting notes */}
          <div>
            <div className="lbl" style={{marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
              📝 Notas post-reunión
              <span style={{fontSize:9,color:"var(--dim)",fontWeight:400}}>— completar después del encuentro</span>
            </div>
            <textarea className="inp" style={{minHeight:60,resize:"vertical",borderColor:postNotes?"rgba(58,140,92,.4)":"",background:postNotes?"rgba(58,140,92,.03)":""}}
              value={postNotes} onChange={e=>setPostNotes(e.target.value)}
              placeholder="Puntos clave discutidos, intereses del inversor, próximos pasos..."/>
          </div>
          {/* Voice note */}
          <div style={{display:"flex",gap:8,alignItems:"center",marginTop:6}}>
            {!recording?(
              <button className="btn bo bs" style={{fontSize:9,gap:4}} onClick={async()=>{
                try{
                  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
                  const mr=new MediaRecorder(stream,{mimeType:MediaRecorder.isTypeSupported("audio/webm")?"audio/webm":"audio/mp4"});
                  chunksRef.current=[];
                  mr.ondataavailable=e=>{if(e.data.size>0)chunksRef.current.push(e.data);};
                  mr.onstop=()=>{
                    const blob=new Blob(chunksRef.current,{type:mr.mimeType});
                    stream.getTracks().forEach(t=>t.stop());
                    if(blob.size>3*1024*1024){setRecording(false);return;} // max 3MB
                    const reader=new FileReader();
                    reader.onload=()=>setVoiceNote(reader.result);
                    reader.readAsDataURL(blob);
                  };
                  mediaRecRef.current=mr;mr.start();setRecording(true);
                }catch{/* mic permission denied */}
              }}>🎙 Grabar nota de voz</button>
            ):(
              <button className="btn bd bs" style={{fontSize:9,gap:4,animation:"pulse .8s infinite"}} onClick={()=>{
                mediaRecRef.current?.stop();setRecording(false);
              }}>⏹ Detener grabación</button>
            )}
            {voiceNote&&!recording&&(
              <>
                <audio src={voiceNote} controls style={{height:28,flex:1}}/>
                <button style={{background:"none",border:"none",color:"var(--red)",cursor:"pointer",fontSize:10}} onClick={()=>setVoiceNote(null)}>✕</button>
              </>
            )}
          </div>
          {/* AI Summary */}
          {mode==="edit"&&(notes||postNotes)&&(
            <button className="btn bo bs" style={{fontSize:9,gap:4,marginTop:8,width:"100%",justifyContent:"center",background:"linear-gradient(135deg,rgba(30,90,176,.04),rgba(51,153,255,.04))",borderColor:"rgba(30,90,176,.2)"}} onClick={()=>{
              const co=companies?.find(c=>c.id===meeting?.companyId);
              const fb=meeting?.feedback||{};
              const INTEREST_L=["","Sin interés","Bajo","Medio","Interesado","Muy interesado"];
              const prompt=`You are a meeting summary assistant for Latin Securities, an investment banking firm in Buenos Aires.

Summarize this meeting into a structured brief (in English, professional tone):

MEETING: ${co?.name||"Meeting"} ${co?.ticker?"("+co.ticker+")":""}
DATE: ${meeting?.date||""} ${meeting?.hour?Math.floor(meeting.hour)+":"+String(Math.round((meeting.hour-Math.floor(meeting.hour))*60)).padStart(2,"0"):""}
FORMAT: ${meeting?.meetingFormat||"Meeting"}

PRE-MEETING NOTES:
${notes||"(none)"}

POST-MEETING NOTES:
${postNotes||"(none)"}

FEEDBACK:
- Interest Level: ${fb.interestLevel?INTEREST_L[fb.interestLevel]:"Not rated"}
- Topics Discussed: ${(fb.topics||[]).join(", ")||"None specified"}
- Next Step: ${fb.nextStep||"Not defined"}
- Internal Notes: ${fb.internalNotes||"(none)"}

Please output:
1. **Executive Summary** (2-3 sentences)
2. **Key Takeaways** (bullet points)
3. **Action Items** (numbered, with owner if obvious)
4. **Interest Assessment** (1 sentence)
5. **Recommended Follow-up** (1 sentence)`;
              navigator.clipboard.writeText(prompt).then(()=>{
                // Try to open Claude in new tab
                window.open("https://claude.ai/new","_blank");
              });
            }}>✨ AI Summary — copiar prompt para Claude</button>
          )}
          {/* Meeting Feedback */}
          {mode==="edit"&&(
            <div style={{borderTop:"1px solid rgba(30,90,176,.08)",paddingTop:14}}>
              <div className="lbl" style={{marginBottom:10,display:"flex",alignItems:"center",gap:7}}>
                📊 Feedback de la reunión
                <span style={{fontSize:9,color:"var(--dim)",fontWeight:400}}>— para reporte interno</span>
              </div>
              <FeedbackWidget feedback={meeting?.feedback||{}} onChange={fb=>{
                // Save feedback inline without closing modal
                const updated={...meeting,feedback:fb};
                onSave(updated);
              }}/>
            </div>
          )}
          {/* Attendees check — who actually went */}
          {mode==="edit"&&type==="company"&&coId&&(()=>{
            const allContacts=(actCos.find(c=>c.id===coId)?.contacts||[]).filter(c=>c.name);
            if(!allContacts.length) return null;
            const checked=actualReps||(selReps.length?selReps:allContacts.map(c=>c.id));
            return(
              <div style={{background:"rgba(58,140,92,.04)",border:"1px solid rgba(58,140,92,.2)",borderRadius:7,padding:"10px 12px"}}>
                <div className="lbl" style={{marginBottom:8,display:"flex",alignItems:"center",gap:6}}>
                  ✅ ¿Quién fue realmente?
                  <span style={{fontSize:9,color:"var(--dim)",fontWeight:400}}>— marcar después de la reunión</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:5}}>
                  {allContacts.map(rep=>{
                    const isChecked=checked.includes(rep.id);
                    return(
                      <label key={rep.id} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:11,color:"var(--txt)"}}>
                        <input type="checkbox" checked={isChecked}
                          onChange={()=>{
                            const next=isChecked?checked.filter(id=>id!==rep.id):[...checked,rep.id];
                            setActualReps(next);
                          }}
                          style={{width:14,height:14,accentColor:"#3a8c5c",flexShrink:0}}/>
                        <span style={{fontWeight:isChecked?600:400}}>{rep.name}</span>
                        {rep.title&&<span style={{fontSize:10,color:"var(--dim)"}}>· {rep.title}</span>}
                      </label>
                    );
                  })}
                </div>
                {actualReps!==null&&actualReps.length===0&&(
                  <div style={{fontSize:10,color:"#b45309",marginTop:6}}>⚠ Ningún representante marcado como presente</div>
                )}
              </div>
            );
          })()}
          {type!=="company"&&(
            <div style={{marginBottom:12}}><div className="lbl">👥 Participantes</div>
              <input className="inp" value={participants} onChange={e=>setParticipants(e.target.value)}
                placeholder="Ej: Rodrigo Nistor, Martin Tapia, Daniela Ramos"/>
              <div style={{fontSize:9,color:"var(--dim)",marginTop:3}}>Nombres separados por coma</div>
            </div>
          )}
          {type==="company"&&coContacts.length>0&&(
            <div style={{marginBottom:4}}>
              <div className="lbl" style={{marginBottom:5}}>👤 Asistentes de la empresa</div>
              <div style={{display:"flex",flexDirection:"column",gap:4,background:"var(--ink3)",borderRadius:6,padding:"6px 8px"}}>
                {coContacts.map(r=>(
                  <label key={r.id} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"3px 4px",borderRadius:4,background:selReps.includes(r.id)?"rgba(30,90,176,.08)":"transparent"}}>
                    <input type="checkbox" style={{accentColor:"var(--gold)"}} checked={selReps.includes(r.id)}
                      onChange={()=>setSelReps(p=>p.includes(r.id)?p.filter(x=>x!==r.id):[...p,r.id])}/>
                    <div style={{flex:1}}>
                      <span style={{fontSize:12,color:"var(--cream)",fontWeight:600}}>{r.name}</span>
                      {r.title&&<span style={{fontSize:10,color:"var(--dim)",marginLeft:5}}>{r.title}</span>}
                    </div>
                    {r.email&&<span style={{fontSize:9,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>{r.email}</span>}
                  </label>
                ))}
                <div style={{display:"flex",justifyContent:"flex-end",gap:6,marginTop:4,paddingTop:4,borderTop:"1px solid rgba(30,90,176,.07)"}}>
                  <button className="btn bo bs" style={{fontSize:9,padding:"2px 7px"}} onClick={()=>setSelReps(coContacts.map(r=>r.id))}>Todos</button>
                  <button className="btn bo bs" style={{fontSize:9,padding:"2px 7px"}} onClick={()=>setSelReps([])}>Ninguno</button>
                </div>
              </div>
            </div>
          )}
          {type==="company"&&coContacts.length===0&&coId&&(
            <div style={{fontSize:11,color:"var(--dim)",background:"var(--ink3)",borderRadius:5,padding:"6px 10px",marginBottom:4}}>
              ℹ Sin representantes cargados para esta empresa. Agregalos en la tab Empresas.
            </div>
          )}
        </div>
        <div className="modal-footer" style={{gap:7}}>
          {mode==="edit"&&<button className="btn bd bs" onClick={onDelete}>🗑 Eliminar</button>}
          {mode==="edit"&&onDuplicate&&<button className="btn bo bs" title="Clonar reunión en otro horario" onClick={onDuplicate}>⧉ Clonar</button>}
          {mode==="edit"&&onExportICS&&<button className="btn bo bs" title="Exportar este evento al calendario (.ics)" onClick={()=>onExportICS(meeting?.id)}>📅 .ics</button>}
          <button className="btn bo bs" onClick={onClose}>Cancelar</button>
          <button className="btn bg bs" onClick={save}>Guardar</button>
        </div>
      </div>
    </div>

    {changeNotif&&(
      <div className="overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={e=>{if(e.target===e.currentTarget)setChangeNotif(null);}}>
        <div className="modal" style={{maxWidth:480}}>
          <div className="modal-hdr">
            <div className="modal-title">📨 Notificar cambio de horario</div>
          </div>
          <div className="modal-body">
            <p style={{fontSize:12,color:"var(--dim)",marginBottom:12,lineHeight:1.6}}>
              La reunión con <strong style={{color:"var(--cream)"}}>{changeNotif.coName}</strong> cambió de horario.
              {changeNotif.contact&&<> Contacto principal: <strong style={{color:"var(--gold)"}}>{changeNotif.contact.name}</strong></>}
            </p>
            <div style={{background:"var(--ink3)",borderRadius:7,padding:"12px 14px",marginBottom:12}}>
              <pre style={{fontFamily:"inherit",fontSize:12,color:"var(--txt)",whiteSpace:"pre-wrap",lineHeight:1.7,margin:0}}>
                {changeNotif.msg}
              </pre>
            </div>
            {changeNotif.contact?.email&&(
              <div style={{fontSize:11,color:"var(--dim)",marginBottom:8}}>
                📧 {changeNotif.contact.email}
              </div>
            )}
          </div>
          <div className="modal-footer" style={{gap:7}}>
            <button className="btn bo bs" onClick={()=>setChangeNotif(null)}>Cerrar</button>
            {changeNotif.contact?.email&&(
              <button className="btn bo bs" onClick={()=>{
                const subject=`Cambio de horario — reunión con ${changeNotif.coName}`;
                window.open(`mailto:${changeNotif.contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(changeNotif.msg)}`);
              }}>✉️ Abrir en Mail</button>
            )}
            <button className="btn bg bs" onClick={()=>{
              navigator.clipboard.writeText(changeNotif.msg).then(()=>{
                alert("✅ Mensaje copiado al portapapeles");
                setChangeNotif(null);
              }).catch(()=>{
                const w=window.open("","_blank","width=520,height=420");
                w.document.write("<pre style='font:13px sans-serif;padding:20px;white-space:pre-wrap'>"+changeNotif.msg.replace(/</g,"&lt;")+"</pre>");
                w.document.close();
              });
            }}>📋 Copiar para WhatsApp</button>
          </div>
        </div>
      </div>
    )}
  </>);
}
