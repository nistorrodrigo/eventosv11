// ── RoadshowOutboundTab.jsx — Outbound Roadshow view ─────────────────
import { useState, useRef } from "react";
import { ROADSHOW_HOURS, fmtHour } from "../roadshow.jsx";
import { esc } from "../storage.jsx";
import { FeedbackWidget } from "../components/FeedbackWidget.jsx";
import { DayDateInput } from "../components/DatePicker.jsx";
import { downloadBlob } from "../storage.jsx";


export function RoadshowOutboundTab({
  outbound, saveOutbound, config, events, globalDB,
  currentEvent,
  obSubTab, setObSubTab,
}){
        const RS_HOURS=ROADSHOW_HOURS;
        function addDest(){
          const nd={id:`dest-${Date.now()}`,city:"",country:"",dateFrom:"",dateTo:"",hotel:"",meetings:[]};
          saveOutbound({...outbound,destinations:[...outbound.destinations,nd]});
        }
        function upDest(id,field,val){saveOutbound({...outbound,destinations:outbound.destinations.map(d=>d.id===id?{...d,[field]:val}:d)});}
        function delDest(id){saveOutbound({...outbound,destinations:outbound.destinations.filter(d=>d.id!==id)});}
        function addMeeting(destId){
          const dest=outbound.destinations.find(d=>d.id===destId);if(!dest)return;
          const nm={id:`obm-${Date.now()}`,fund:"",contact:"",email:"",hour:9,duration:60,status:"tentative",location:"",notes:"",date:dest.dateFrom||""};
          const nd=outbound.destinations.map(d=>d.id===destId?{...d,meetings:[...d.meetings,nm]}:d);
          saveOutbound({...outbound,destinations:nd});
        }
        function upMeeting(destId,mtgId,field,val){
          const nd=outbound.destinations.map(d=>d.id===destId?{...d,meetings:d.meetings.map(m=>m.id===mtgId?{...m,[field]:val}:m)}:d);
          saveOutbound({...outbound,destinations:nd});
        }
        function delMeeting(destId,mtgId){
          const nd=outbound.destinations.map(d=>d.id===destId?{...d,meetings:d.meetings.filter(m=>m.id!==mtgId)}:d);
          saveOutbound({...outbound,destinations:nd});
        }
        const totalMtgs=outbound.destinations.reduce((s,d)=>s+d.meetings.length,0);
        const confirmed=outbound.destinations.reduce((s,d)=>s+d.meetings.filter(m=>m.status==="confirmed").length,0);
        const fmtShort=iso=>iso?new Date(iso+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"}):"";
        const COUNTRY_FLAGS={US:"🇺🇸","United States":"🇺🇸",Brazil:"🇧🇷",Brasil:"🇧🇷",Chile:"🇨🇱",UK:"🇬🇧","United Kingdom":"🇬🇧",Germany:"🇩🇪",Alemania:"🇩🇪",France:"🇫🇷",Francia:"🇫🇷",Spain:"🇪🇸",España:"🇪🇸",Netherlands:"🇳🇱",Italy:"🇮🇹",Switzerland:"🇨🇭",Portugal:"🇵🇹",Japan:"🇯🇵",Canada:"🇨🇦",Mexico:"🇲🇽"};
        const flag=c=>COUNTRY_FLAGS[c]||"🌎";

        function exportOutboundAgenda(){
          const lsCont=(config.contacts||[])[0]||{};
          const teamNames=(outbound.team||[]).map(t=>t.name).filter(Boolean);
          const lines=outbound.destinations.map(dest=>{
            if(!dest.meetings.length) return null;
            const sortedMtgs=[...dest.meetings].sort((a,b)=>(a.date+a.hour).localeCompare(b.date+b.hour));
            const header=`${flag(dest.country)} ${dest.city.toUpperCase()}${dest.country?", "+dest.country:""} ${fmtShort(dest.dateFrom)?("("+fmtShort(dest.dateFrom)+(dest.dateTo&&dest.dateTo!==dest.dateFrom?"–"+fmtShort(dest.dateTo):"")+")"):""}
${"─".repeat(40)}`;
            const rows=sortedMtgs.map(m=>{
              const d=m.date?new Date(m.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}):"";
              return `  ${fmtHour(m.hour||0)}${d?" · "+d:""} | ${m.fund||"[Fund]"} | ${m.contact||""} | ${m.status==="confirmed"?"✓":"⏳"} | ${m.location||""}${m.notes?" — "+m.notes:""}`;
            }).join("\n");
            return header+"\n"+rows;
          }).filter(Boolean).join("\n\n");
          const NL="\n";const txt="LATIN SECURITIES — OUTBOUND ROADSHOW"+NL+(outbound.fund?outbound.fund+NL:"")+(teamNames.length?"Team: "+teamNames.join(", ")+NL:"")+NL+(lines||"No meetings yet.")+NL+NL+"Contact: "+(lsCont.name||"[LS]")+" · "+(lsCont.email||"")+" · "+(lsCont.phone||"")
          navigator.clipboard.writeText(txt).then(()=>alert("✅ Agenda copiada al portapapeles.")).catch(()=>{const w=window.open("","_blank","width=680,height=560");w.document.write("<pre style='font:13px monospace;padding:20px;white-space:pre-wrap'>"+txt+"</pre>");w.document.close();});
        }

        function exportOutboundICS(){
          const pad=n=>String(n).padStart(2,"0");
          const esc=s=>(s||"").replace(/[\\,;]/g,"\\$&").replace(/\n/g,"\\n");
          const dur=60;
          const events=outbound.destinations.flatMap(dest=>
            dest.meetings.filter(m=>m.status!=="cancelled"&&m.date&&m.hour).map(m=>{
              const d=new Date(m.date+"T"+pad(m.hour)+":00:00");
              const de=new Date(d.getTime()+(m.duration||dur)*60000);
              const fmt=dd=>dd.getUTCFullYear()+pad(dd.getUTCMonth()+1)+pad(dd.getUTCDate())+"T"+pad(dd.getUTCHours())+pad(dd.getUTCMinutes())+"00Z";
              const teamAttendees=(outbound.team||[]).filter(t=>t.email).map(t=>`ATTENDEE;CN="${esc(t.name)}":mailto:${t.email}`).join("\r\n");
              return `BEGIN:VEVENT\r\nUID:ob-${m.id}@latinsecurities.ar\r\nDTSTAMP:${fmt(new Date())}\r\nDTSTART:${fmt(d)}\r\nDTEND:${fmt(de)}\r\nSUMMARY:${esc((m.fund||"Meeting")+" – "+dest.city)}\r\nLOCATION:${esc(m.location||(dest.city+", "+dest.country))}\r\nDESCRIPTION:${esc(m.notes||"")}\r\n${teamAttendees?teamAttendees+"\r\n":""}END:VEVENT`;
            })
          );
          const ics=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Latin Securities//Outbound//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n${events.join("\r\n")}\r\nEND:VCALENDAR`;
          const fn=`Outbound_${(outbound.fund||currentEvent?.name||"Roadshow").replace(/[^a-zA-Z0-9]/g,"_")}.ics`;
          downloadBlob(fn,ics,"text/calendar;charset=utf-8");
        }

        return(
        <div>
          {/* Header */}
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <div>
              <h2 className="pg-h" style={{marginBottom:2}}>✈️ Roadshow Outbound</h2>
              <p className="pg-s" style={{marginBottom:0}}>Latin Securities viaja a ver fondos. Organizá la agenda por ciudad.</p>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:10,color:"var(--grn)",padding:"4px 10px",borderRadius:5,background:"rgba(58,140,92,.1)"}}>{`${confirmed}/${totalMtgs}`} ✓ confirmadas</div>
              <button className="btn bo bs" style={{fontSize:10,gap:4}} onClick={exportOutboundAgenda}>📋 Copiar agenda</button>
              <button className="btn bo bs" style={{fontSize:10,gap:4}} onClick={exportOutboundICS}>📅 ICS</button>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{display:"flex",gap:0,marginBottom:14,borderBottom:"1px solid rgba(30,90,176,.1)"}}>
            {[["schedule","📅 Itinerario"],["team","👥 Equipo LS"],["export","📄 Exportar"]].map(([id,lbl])=>(
              <button key={id} className={`ntab${obSubTab===id?" on":""}`} style={{height:38,fontSize:10}} onClick={()=>setObSubTab(id)}>{lbl}</button>
            ))}
          </div>

          {/* ITINERARY */}
          {obSubTab==="schedule"&&(
            <div>
              {/* Trip info card */}
              <div className="card" style={{marginBottom:14}}>
                <div className="card-t">🧳 Info del Roadshow</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                  <div><div className="lbl">Fondo / Cliente</div><input className="inp" value={outbound.fund||""} placeholder="Ej: Merrill Lynch 2026" onChange={e=>saveOutbound({...outbound,fund:e.target.value})}/></div>
                  <div><div className="lbl">Subtítulo / descripción</div><input className="inp" value={outbound.subtitle||""} placeholder="Ej: Marketing roadshow Q2" onChange={e=>saveOutbound({...outbound,subtitle:e.target.value})}/></div>
                  <div><div className="lbl">Notas generales</div><input className="inp" value={outbound.notes||""} placeholder="Logística, visa, etc." onChange={e=>saveOutbound({...outbound,notes:e.target.value})}/></div>
                </div>
              </div>

              {/* Destinations */}
              {outbound.destinations.map((dest,di)=>{
                const sortedMtgs=[...dest.meetings].sort((a,b)=>(a.date+String(a.hour)).localeCompare(b.date+String(b.hour)));
                return(
                  <div key={dest.id} className="card" style={{marginBottom:14,borderLeft:`3px solid ${["#1e5ab0","#23a29e","#e8850a","#7b35b0","#3a8c5c"][di%5]}`}}>
                    {/* Destination header */}
                    <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:12,flexWrap:"wrap"}}>
                      <div style={{fontSize:28}}>{flag(dest.country)}</div>
                      <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                        <div><div className="lbl">Ciudad</div><input className="inp" style={{fontSize:12}} value={dest.city} placeholder="New York" onChange={e=>upDest(dest.id,"city",e.target.value)}/></div>
                        <div><div className="lbl">País</div>
                          <select className="sel" style={{fontSize:12}} value={dest.country} onChange={e=>upDest(dest.id,"country",e.target.value)}>
                            <option value="">— País —</option>
                            {["United States","Brazil","Chile","United Kingdom","Germany","France","Netherlands","Spain","Switzerland","Italy","Portugal","Canada","Mexico","Japan"].map(c=><option key={c} value={c}>{flag(c)} {c}</option>)}
                          </select></div>
                        <div><div className="lbl">Llegada</div><DayDateInput day={{date:dest.dateFrom,short:dest.dateFrom,long:""}} di={di*2} onChange={nd=>upDest(dest.id,"dateFrom",nd.date)}/></div>
                        <div><div className="lbl">Salida</div><DayDateInput day={{date:dest.dateTo,short:dest.dateTo,long:""}} di={di*2+1} onChange={nd=>upDest(dest.id,"dateTo",nd.date)}/></div>
                      </div>
                      <div style={{display:"flex",gap:5,flexShrink:0}}>
                        <button className="btn bg bs" style={{fontSize:9}} onClick={()=>addMeeting(dest.id)}>+ Reunión</button>
                        <button aria-label="Eliminar destino" className="btn bd bs" style={{fontSize:9}} onClick={()=>{if(confirm(`Eliminar ${dest.city||"destino"}?`))delDest(dest.id);}}>✕</button>
                      </div>
                    </div>
                    <div style={{marginBottom:8}}><div className="lbl">Hotel</div><input className="inp" style={{fontSize:11}} value={dest.hotel||""} placeholder="Four Seasons, Hilton, etc." onChange={e=>upDest(dest.id,"hotel",e.target.value)}/></div>

                    {/* Visual time grid — 30-min slots, one col per day */}
                    {(()=>{
                      // Snap :15/:45 → nearest :00/:30 for display only
                      const snapH=h=>Math.round(h*2)/2;
                      // Collect unique days in this destination
                      const destDays=[...new Set(dest.meetings.map(m=>m.date))].sort();
                      // 30-min slot rows 8:00–20:00
                      const OB_SLOTS=Array.from({length:25},(_,i)=>8+i*0.5); // 8.0,8.5,...20.0
                      // Build slot→meeting map per day
                      const slotMap={};
                      dest.meetings.forEach(m=>{
                        const key=`${m.date}-${snapH(m.hour)}`;
                        slotMap[key]=m;
                      });
                      const clrByStatus={confirmed:"#23a29e",tentative:"#e8850a",cancelled:"#b03030"};
                      return(
                      <div>
                        {/* Grid */}
                        {destDays.length>0&&(
                        <div style={{overflowX:"auto",marginBottom:10}}>
                          <table style={{borderCollapse:"collapse",fontSize:10,tableLayout:"fixed"}}>
                            <colgroup>
                              <col style={{width:42}}/>
                              {destDays.map(d=><col key={d} style={{width:Math.max(90,Math.floor(600/destDays.length))}}/>)}
                            </colgroup>
                            <thead>
                              <tr>
                                <th style={{padding:"3px 4px",fontSize:8,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}></th>
                                {destDays.map(d=>{
                                  const dt=new Date(d+"T12:00:00");
                                  return <th key={d} style={{padding:"4px 6px",textAlign:"center",fontSize:9,fontFamily:"IBM Plex Mono,monospace",color:"var(--cream)",fontWeight:700,borderBottom:"2px solid rgba(30,90,176,.15)",background:"rgba(30,90,176,.04)"}}>
                                    <div>{dt.toLocaleDateString("es-AR",{weekday:"short"}).replace(".","")}</div>
                                    <div style={{fontSize:11,fontWeight:900}}>{dt.getDate()}</div>
                                  </th>;
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {OB_SLOTS.map(slot=>{
                                const isHour=slot%1===0;
                                return(
                                <tr key={slot} style={{height:isHour?22:18}}>
                                  <td style={{
                                    textAlign:"right",padding:"0 5px 0 0",fontSize:8,
                                    fontFamily:"IBM Plex Mono,monospace",color:isHour?"var(--dim)":"rgba(120,140,170,.35)",
                                    verticalAlign:"top",paddingTop:2,borderRight:"2px solid rgba(30,90,176,.07)",
                                    whiteSpace:"nowrap"
                                  }}>
                                    {isHour?fmtHour(slot):"·"}
                                  </td>
                                  {destDays.map(day=>{
                                    const m=slotMap[`${day}-${slot}`];
                                    const clr=m?clrByStatus[m.status]||"#666":null;
                                    return(
                                      <td key={day} style={{
                                        border:"1px solid rgba(30,90,176,.04)",
                                        background:isHour?"rgba(30,90,176,.01)":"transparent",
                                        padding:1,verticalAlign:"top",cursor:m?"pointer":"default"
                                      }}
                                        onClick={()=>{if(!m)return;const idx=dest.meetings.findIndex(x=>x.id===m.id);if(idx>=0)document.getElementById(`ob-mtg-${m.id}`)?.scrollIntoView({behavior:"smooth",block:"center"});}}
                                      >
                                        {m&&<div style={{
                                          background:`${clr}22`,border:`1px solid ${clr}55`,
                                          borderLeft:`3px solid ${clr}`,borderRadius:3,
                                          padding:"2px 4px",fontSize:8.5,lineHeight:1.3,
                                          overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",
                                          color:"var(--cream)",fontWeight:600
                                        }} title={`${fmtHour(m.hour)} ${m.fund||"?"} — ${m.location||""}`}>
                                          {fmtHour(m.hour)} {m.fund||"?"}
                                        </div>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );})}
                            </tbody>
                          </table>
                        </div>
                        )}

                        {/* Editable list below grid */}
                        {sortedMtgs.map((m,mi)=>(
                          <div key={m.id}>
                          <div id={`ob-mtg-${m.id}`} style={{
                            display:"grid",gridTemplateColumns:"100px 70px 1fr 1fr 1fr 100px 1fr 28px",
                            gap:4,alignItems:"center",marginBottom:4,padding:"5px 6px",
                            background:mi%2===0?"rgba(30,90,176,.02)":"transparent",
                            borderRadius:5,border:"1px solid rgba(30,90,176,.04)"
                          }}>
                            <DayDateInput day={{date:m.date,short:m.date,long:""}} di={di*100+mi} onChange={nd=>upMeeting(dest.id,m.id,"date",nd.date)}/>
                            <select className="sel" style={{fontSize:10,padding:"3px 5px"}} value={m.hour} onChange={e=>upMeeting(dest.id,m.id,"hour",parseFloat(e.target.value))}>
                              {RS_HOURS.map(h=><option key={h} value={h}>{fmtHour(h)}</option>)}
                            </select>
                            <input className="inp" style={{fontSize:10,padding:"3px 6px"}} value={m.fund||""} placeholder="Fondo / Nombre" onChange={e=>upMeeting(dest.id,m.id,"fund",e.target.value)}/>
                            <input className="inp" style={{fontSize:10,padding:"3px 6px"}} value={m.email||""} placeholder="email@fondo.com" onChange={e=>upMeeting(dest.id,m.id,"email",e.target.value)}/>
                            <input className="inp" style={{fontSize:10,padding:"3px 6px"}} value={m.location||""} placeholder={`Dirección en ${dest.city||"destino"}...`} onChange={e=>upMeeting(dest.id,m.id,"location",e.target.value)}/>
                            <select className="sel" style={{fontSize:10,padding:"3px 5px"}} value={m.status} onChange={e=>upMeeting(dest.id,m.id,"status",e.target.value)}>
                              <option value="tentative">⏳ Tentativo</option>
                              <option value="confirmed">✅ Confirmado</option>
                              <option value="cancelled">❌ Cancelado</option>
                            </select>
                            <input className="inp" style={{fontSize:10,padding:"3px 6px"}} value={m.notes||""} placeholder="Agenda, contexto..." onChange={e=>upMeeting(dest.id,m.id,"notes",e.target.value)}/>
                            <button aria-label="Eliminar" className="btn bd bs" style={{fontSize:9,padding:"2px 4px"}} onClick={()=>delMeeting(dest.id,m.id)}>✕</button>
                            <button
                              title="Feedback de la reunión"
                              className={`btn bs ${m.feedback?.interestLevel?"bg":"bo"}`}
                              style={{fontSize:9,padding:"2px 7px",flexShrink:0}}
                              onClick={()=>upMeeting(dest.id,m.id,"showFeedback",!m.showFeedback)}>
                              {m.feedback?.interestLevel?(["","💤","😐","👍","😃","🔥"][m.feedback.interestLevel]):"📊"}
                            </button>
                          </div>
                          {m.showFeedback&&<div style={{marginBottom:6,padding:"12px 14px",background:"rgba(30,90,176,.03)",borderRadius:8,border:"1px solid rgba(30,90,176,.08)"}}><FeedbackWidget compact feedback={m.feedback||{}} onChange={fb=>upMeeting(dest.id,m.id,"feedback",fb)}/></div>}
                        </div>
                        ))}
                        {!sortedMtgs.length&&<div style={{fontSize:11,color:"var(--dim)",padding:"8px 0"}}>Sin reuniones — clic en + Reunión para agregar.</div>}
                      </div>
                      );
                    })()}
                  </div>
                );
              })}

              <button className="btn bg bs" style={{gap:6,marginTop:4}} onClick={addDest}>
                🌎 Agregar destino / ciudad
              </button>
              {!outbound.destinations.length&&(
                <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)",marginTop:14}}>
                  <div style={{fontSize:36,marginBottom:8}}>✈️</div>
                  <div style={{fontSize:14,color:"var(--cream)",marginBottom:6}}>Agregá los destinos del roadshow</div>
                  <div style={{fontSize:12}}>Cada destino tiene su ciudad, fechas y lista de fondos a visitar.</div>
                </div>
              )}
            </div>
          )}

          {/* TEAM */}
          {obSubTab==="team"&&(
            <div>
              <div className="card" style={{marginBottom:14}}>
                <div className="card-t">👥 Equipo Latin Securities que viaja</div>
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:12,lineHeight:1.6}}>Miembros del equipo LS en este roadshow. Se incluyen como attendees en el ICS.</p>
                {(outbound.team||[]).map((t,ti)=>(
                  <div key={ti} style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                    <input className="inp" style={{flex:2,fontSize:11,padding:"3px 7px"}} value={t.name||""} placeholder="Nombre" onChange={e=>{const tm=[...(outbound.team||[])];tm[ti]={...tm[ti],name:e.target.value};saveOutbound({...outbound,team:tm});}}/>
                    <input className="inp" style={{flex:1.5,fontSize:11,padding:"3px 7px"}} value={t.title||""} placeholder="Cargo" onChange={e=>{const tm=[...(outbound.team||[])];tm[ti]={...tm[ti],title:e.target.value};saveOutbound({...outbound,team:tm});}}/>
                    <input className="inp" style={{flex:2,fontSize:11,padding:"3px 7px"}} value={t.email||""} placeholder="email@latinsecurities.ar" onChange={e=>{const tm=[...(outbound.team||[])];tm[ti]={...tm[ti],email:e.target.value};saveOutbound({...outbound,team:tm});}}/>
                    <button aria-label="Eliminar" className="btn bd bs" style={{fontSize:9,padding:"2px 6px",flexShrink:0}} onClick={()=>{const tm=(outbound.team||[]).filter((_,j)=>j!==ti);saveOutbound({...outbound,team:tm});}}>✕</button>
                  </div>
                ))}
                <button className="btn bo bs" style={{fontSize:10,marginTop:6}} onClick={()=>saveOutbound({...outbound,team:[...(outbound.team||[]),{name:"",title:"",email:""}]})}>+ Agregar miembro</button>
              </div>
              {/* Preset LS contacts */}
              {(config.contacts||[]).length>0&&(
                <div className="card">
                  <div className="card-t">⚡ Agregar desde contactos LS</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {(config.contacts||[]).map((c,ci)=>{
                      const already=(outbound.team||[]).some(t=>t.email===c.email||t.name===c.name);
                      return(<button key={ci} className="btn bo bs" style={{fontSize:10,opacity:already?.5:1}} onClick={()=>{if(!already)saveOutbound({...outbound,team:[...(outbound.team||[]),{name:c.name,title:c.role||"",email:c.email||""}]});}}>
                        {already?"✓ ":""}{c.name}
                      </button>);
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EXPORT */}
          {obSubTab==="export"&&(
            <div>
              <div className="sec-hdr" style={{marginBottom:8}}>📄 Agenda del Roadshow</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportOutboundAgenda} onKeyDown={e=>{if(e.key==="Enter")exportOutboundAgenda();}}>
                  <div className="ex-card-ico">📋</div>
                  <div className="ex-card-t">Copiar agenda (texto)</div>
                  <div className="ex-card-s">Agenda completa por ciudad, lista para pegar en email o WhatsApp.</div>
                </div>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportOutboundICS} onKeyDown={e=>{if(e.key==="Enter")exportOutboundICS();}}>
                  <div className="ex-card-ico">📅</div>
                  <div className="ex-card-t">Exportar .ICS (Outlook)</div>
                  <div className="ex-card-s">Todas las reuniones del equipo LS como invitaciones de calendario.</div>
                </div>
              </div>
              <div className="card" style={{marginBottom:14}}>
                <div className="card-t">🔗 Resumen del itinerario</div>
                <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:11,color:"var(--txt)",lineHeight:1.9}}>
                  {outbound.destinations.map(d=>(
                    <div key={d.id} style={{marginBottom:4}}>
                      <span style={{fontSize:14}}>{flag(d.country)}</span>
                      <strong style={{color:"var(--cream)",marginLeft:6}}>{d.city}{d.country?", "+d.country:""}</strong>
                      {(d.dateFrom||d.dateTo)&&<span style={{color:"var(--dim)",marginLeft:8}}>{fmtShort(d.dateFrom)}{d.dateTo&&d.dateTo!==d.dateFrom?"–"+fmtShort(d.dateTo):""}</span>}
                      <span style={{color:"var(--gold)",marginLeft:8}}>{d.meetings.length} reunión{d.meetings.length!==1?"es":""}</span>
                      {d.hotel&&<span style={{color:"var(--dim)",marginLeft:8}}>· {d.hotel}</span>}
                    </div>
                  ))}
                  {!outbound.destinations.length&&<span style={{color:"var(--dim)"}}>Sin destinos cargados.</span>}
                </div>
              </div>
            </div>
          )}
        </div>
        );
}
