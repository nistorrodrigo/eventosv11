// ── DashboardView.jsx — Landing page / auth / dashboard ─────────────────
import { useState } from "react";
import { downloadBlob, saveEvents } from "../storage.jsx";
import { CSS } from "../styles.js";

export function DashboardView({
  events, dashEvents, setEvents, saveEvents,
  hasEvents, cloudSaveEvent, hashPwd,
  createEvent, duplicateEvent, setEvPassword,
  cloudDeleteEvent, handleOpenEvent,
  activeEv, setActiveEv, config,
  authUser, authView, setAuthView,
  authEmail, setAuthEmail, authPwd, setAuthPwd,
  authName, setAuthName, authErr, setAuthErr, authBusy,
  signIn, signUp, signOut,
  dashboardView, setDashboardView,
  showEvMgr, setShowEvMgr,
  showSearch, setShowSearch, globalSearch, setGlobalSearch,
  searchFilter, setSearchFilter, searchStatus, setSearchStatus,
  evPasswordModal, setEvPasswordModal,
  evPasswordInput, setEvPasswordInput,
  newEvKind, setNewEvKind, newEvName, setNewEvName,
  kioskMode, setKioskMode, kioskIdx, setKioskIdx,
  setKioskFb, setRsDayFilter,
  setTab, setRsSubTab,
}){
  return(
    <div className="app"><style>{CSS}</style>
      <div style={{minHeight:"100vh",background:"#f2f5fb",fontFamily:"'Lora',Georgia,serif"}}>

        {/* ══ NAVBAR ══ */}
        <div style={{background:"#000039",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
          <div style={{maxWidth:1200,margin:"0 auto",padding:"0 40px",display:"flex",alignItems:"center",justifyContent:"space-between",height:58}}>
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <div style={{display:"flex",alignItems:"center",gap:1}}><span style={{fontFamily:"Playfair Display,serif",fontSize:14,fontWeight:700,color:"#fff",letterSpacing:".04em",lineHeight:1}}>Latin</span><span style={{fontFamily:"Playfair Display,serif",fontSize:14,fontWeight:400,color:"rgba(255,255,255,.7)",letterSpacing:".04em",lineHeight:1,marginLeft:5}}>Securities</span></div>
              <div style={{width:1,height:22,background:"rgba(255,255,255,.12)"}}/>
              <span style={{fontFamily:"IBM Plex Mono,monospace",fontSize:9.5,color:"rgba(255,255,255,.38)",letterSpacing:".25em",textTransform:"uppercase",fontWeight:500}}>Event Manager</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              {authUser&&<span style={{fontSize:10,color:"rgba(255,255,255,.35)",fontFamily:"IBM Plex Mono,monospace",letterSpacing:".04em"}}>{authUser.email}</span>}
              {authUser&&<button
                style={{padding:"5px 14px",border:"1px solid rgba(255,255,255,.15)",borderRadius:4,background:"rgba(255,255,255,.04)",color:"rgba(255,255,255,.5)",fontSize:10.5,cursor:"pointer",fontFamily:"inherit",letterSpacing:".04em",transition:"all .15s"}}
                onMouseEnter={e=>{e.target.style.borderColor="rgba(255,255,255,.35)";e.target.style.color="rgba(255,255,255,.8)";}}
                onMouseLeave={e=>{e.target.style.borderColor="rgba(255,255,255,.15)";e.target.style.color="rgba(255,255,255,.5)";}}
                onClick={signOut}>Salir</button>}
            </div>
          </div>
        </div>

        {/* ══ HERO ══ */}
        <div style={{background:"linear-gradient(165deg,#000039 0%,#091040 55%,#0e1852 100%)",padding:"52px 40px 76px",position:"relative",overflow:"hidden"}}>
          {/* Diagonal grid decoration */}
          <div style={{position:"absolute",inset:0,opacity:.04,backgroundImage:"repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)",backgroundSize:"30px 30px",pointerEvents:"none"}}/>
          {/* Accent line */}
          <div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#1e5ab0 30%,#3399ff 60%,transparent)"}}/>
          <div style={{maxWidth:1200,margin:"0 auto",position:"relative"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:20}}>
              <div>
                <div style={{fontSize:10,fontFamily:"IBM Plex Mono,monospace",color:"rgba(255,255,255,.3)",letterSpacing:".28em",textTransform:"uppercase",marginBottom:14}}>Buenos Aires · Latin Securities</div>
                <h1 style={{fontFamily:"Playfair Display,serif",fontSize:42,fontWeight:400,color:"#fff",margin:"0 0 10px",letterSpacing:"-.02em",lineHeight:1.1}}>Roadshow &amp; Event Manager</h1>
                <p style={{fontSize:12,color:"rgba(255,255,255,.38)",fontFamily:"IBM Plex Mono,monospace",margin:0,letterSpacing:".07em"}}>Institutional Sales · Gestión de agenda y exportación</p>
              </div>
              <div style={{display:"flex",gap:10,alignSelf:"flex-end",paddingBottom:4}}>
                <button
                  style={{padding:"10px 20px",background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.15)",borderRadius:7,color:"rgba(255,255,255,.7)",fontSize:12,cursor:"pointer",fontFamily:"inherit",letterSpacing:".04em",transition:"all .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.12)";e.currentTarget.style.borderColor="rgba(255,255,255,.3)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.07)";e.currentTarget.style.borderColor="rgba(255,255,255,.15)";}}
                  onClick={()=>setShowEvMgr(true)}>+ Nuevo evento</button>
              </div>
            </div>
          </div>
        </div>

        {/* ══ MAIN CONTENT ══ */}
        <div style={{maxWidth:1200,margin:"-22px auto 0",padding:"0 40px 60px",position:"relative"}}>

          {/* ── Stats card ── */}
          {hasEvents&&(
            <div style={{display:"flex",gap:0,marginBottom:36,background:"#fff",borderRadius:14,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,57,.09),0 1px 3px rgba(0,0,0,.05)"}}>
              {[
                {lbl:"Total",     val:events.length,                                            clr:"#000039"},
                {lbl:"En curso",  val:dashEvents.filter(e=>e.state==="active").length,          clr:"#166534"},
                {lbl:"Próximos",  val:dashEvents.filter(e=>e.state==="upcoming").length,        clr:"#1e5ab0"},
                {lbl:"Borradores",val:dashEvents.filter(e=>e.state==="draft").length,           clr:"#b45309"},
                {lbl:"Finalizados",val:dashEvents.filter(e=>e.state==="past").length,           clr:"#6b7280"},
                {lbl:"Reuniones", val:dashEvents.reduce((s,e)=>{return s+(e.roadshow?.meetings||e.meetings||[]).length;},0), clr:"#1e5ab0"},
              ].map(({lbl,val,clr},i)=>(
                <div key={lbl} style={{flex:1,padding:"20px 12px",borderRight:"1px solid #f0f3f8",textAlign:"center",transition:"background .15s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="#f9fafb";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="";}}
                >
                  <div style={{fontSize:28,fontWeight:700,color:clr,fontFamily:"Playfair Display,serif",lineHeight:1,marginBottom:6}}>{val}</div>
                  <div style={{fontSize:8.5,color:"#9ca3af",fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".1em"}}>{lbl}</div>
                </div>
              ))}
              <div style={{padding:"20px 20px",display:"flex",alignItems:"center",borderLeft:"1px solid #f0f3f8"}}>
                <button
                  style={{whiteSpace:"nowrap",fontSize:12,padding:"10px 20px",background:"#000039",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,letterSpacing:".03em",fontFamily:"inherit",transition:"background .15s,transform .1s",boxShadow:"0 2px 8px rgba(0,0,57,.25)"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="#0d1a4a";e.currentTarget.style.transform="translateY(-1px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="#000039";e.currentTarget.style.transform="";}}
                  onClick={()=>setShowEvMgr(true)}>＋ Nuevo</button>
              </div>
            </div>
          )}

          {/* ── Event sections ── */}
          {hasEvents&&(()=>{
            const SECTIONS=[
              {state:"active",  icon:"🟢",label:"En curso",    clr:"#166534",accent:"#dcfce7"},
              {state:"upcoming",icon:"🔵",label:"Próximos",    clr:"#1e5ab0",accent:"#dbeafe"},
              {state:"draft",   icon:"⚪",label:"Borradores",  clr:"#b45309",accent:"#fef3c7"},
              {state:"past",    icon:"⚫",label:"Finalizados", clr:"#6b7280",accent:"#f3f4f6"},
            ];
            return SECTIONS.map(sec=>{
              const evs=dashEvents.filter(e=>e.state===sec.state);
              if(!evs.length) return null;
              return(
                <div key={sec.state} style={{marginBottom:36}}>
                  {/* Section header */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:sec.clr,boxShadow:`0 0 0 3px ${sec.accent}`}}/>
                    <span style={{fontSize:10,fontWeight:700,color:sec.clr,fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".18em"}}>{sec.label}</span>
                    <span style={{fontSize:10,color:"#cbd5e1",fontFamily:"IBM Plex Mono,monospace",letterSpacing:".04em"}}>({evs.length})</span>
                    <div style={{flex:1,height:1,background:"linear-gradient(90deg,"+sec.clr+"25,transparent)"}}/>
                  </div>
                  {/* Cards grid */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(310px,1fr))",gap:12}}>
                    {evs.map(ev=>{
                      const kindIcon=ev.kind==="roadshow"?"🗺️":ev.kind==="outbound"?"✈️":"🏛";
                      const kindLbl=ev.kind==="roadshow"?"Inbound":ev.kind==="outbound"?"Outbound":"Conferencia";
                      const totalMtgs=(ev.roadshow?.meetings||ev.meetings||[]).length;
                      const pct=totalMtgs>0?Math.round(ev.conf/totalMtgs*100):0;
                      return(
                        <div key={ev.id}
                          onClick={()=>{setDashboardView(false);handleOpenEvent(ev.id);}}
                          style={{background:"#fff",border:"1px solid #e9eef5",borderRadius:12,
                            padding:"20px 22px",cursor:"pointer",transition:"all .18s cubic-bezier(.4,0,.2,1)",
                            position:"relative",overflow:"hidden",
                            boxShadow:"0 1px 4px rgba(0,0,57,.05)"}}
                          onMouseEnter={e=>{
                            e.currentTarget.style.transform="translateY(-3px)";
                            e.currentTarget.style.boxShadow=`0 12px 36px ${sec.clr}22,0 2px 8px rgba(0,0,0,.06)`;
                            e.currentTarget.style.borderColor=`${sec.clr}40`;
                          }}
                          onMouseLeave={e=>{
                            e.currentTarget.style.transform="";
                            e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,57,.05)";
                            e.currentTarget.style.borderColor="#e9eef5";
                          }}>
                          {/* Left bar */}
                          <div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:`linear-gradient(180deg,${sec.clr},${sec.clr}88)`}}/>
                          {/* Top row */}
                          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
                            <div style={{display:"flex",alignItems:"center",gap:7}}>
                              <span style={{fontSize:17}}>{kindIcon}</span>
                              <span style={{fontSize:8.5,color:sec.clr,fontFamily:"IBM Plex Mono,monospace",fontWeight:700,background:sec.accent,padding:"2px 7px",borderRadius:4,textTransform:"uppercase",letterSpacing:".1em"}}>{kindLbl}</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              {ev.dates&&<span style={{fontSize:9,color:"#9ca3af",fontFamily:"IBM Plex Mono,monospace",letterSpacing:".04em"}}>{ev.dates}</span>}
                              <span style={{fontSize:9,color:sec.clr,opacity:.6,fontFamily:"IBM Plex Mono,monospace",letterSpacing:".04em"}}>→</span>
                            </div>
                          </div>
                          {/* Name */}
                          <div style={{fontFamily:"Playfair Display,serif",fontSize:17,color:"#000039",fontWeight:700,marginBottom:ev.fund?4:10,lineHeight:1.2,letterSpacing:"-.01em"}}>{ev.name}</div>
                          {ev.fund&&<div style={{fontSize:10.5,color:"#7a8fa8",marginBottom:10,fontFamily:"IBM Plex Mono,monospace",letterSpacing:".03em"}}>{ev.fund}</div>}
                          {/* Progress bar (if has meetings) */}
                          {totalMtgs>0&&(
                            <div style={{marginBottom:10}}>
                              <div style={{height:3,background:"#f0f3f8",borderRadius:2,overflow:"hidden"}}>
                                <div style={{height:"100%",width:pct+"%",background:`linear-gradient(90deg,${sec.clr},${sec.clr}aa)`,borderRadius:2,transition:"width .4s ease"}}/>
                              </div>
                            </div>
                          )}
                          {/* Stats row */}
                          <div style={{display:"flex",gap:14,alignItems:"center",paddingTop:10,borderTop:"1px solid #f0f3f8"}}>
                            {ev.conf>0&&<span style={{fontSize:10,color:"#166534",fontWeight:700,fontFamily:"IBM Plex Mono,monospace"}}>✓ {ev.conf}</span>}
                            {ev.tent>0&&<span style={{fontSize:10,color:"#b45309",fontFamily:"IBM Plex Mono,monospace"}}>◌ {ev.tent}</span>}
                            {totalMtgs>0&&<span style={{fontSize:10,color:"#9ca3af",fontFamily:"IBM Plex Mono,monospace"}}>{totalMtgs} mtgs</span>}
                            {ev.invs>0&&<span style={{fontSize:10,color:"#9ca3af",fontFamily:"IBM Plex Mono,monospace"}}>{ev.invs} inv.</span>}
                            <div style={{display:"flex",gap:6,marginLeft:"auto"}} onClick={e=>e.stopPropagation()}>
                              <button style={{fontSize:9,padding:"2px 8px",border:"1px solid #e5e7eb",borderRadius:4,background:"#fff",color:"#6b7280",cursor:"pointer",fontFamily:"inherit"}}
                                onClick={e=>{e.stopPropagation();const n=prompt("Renombrar evento:",ev.name);if(n&&n.trim()&&n.trim()!==ev.name){const next=events.map(x=>x.id===ev.id?{...x,name:n.trim()}:x);setEvents(next);saveEvents(next);cloudSaveEvent({...ev,name:n.trim()});}}}
                              >✏️</button>
                              {events.length>1&&<button style={{fontSize:9,padding:"2px 8px",border:"1px solid #fee2e2",borderRadius:4,background:"#fff",color:"#dc2626",cursor:"pointer",fontFamily:"inherit"}}
                                onClick={e=>{e.stopPropagation();if(confirm(`Eliminar "${ev.name}"?`)){const next=events.filter(x=>x.id!==ev.id);setEvents(next);saveEvents(next);cloudDeleteEvent(ev.id);if(activeEv===ev.id)setActiveEv(next[0]?.id||null);}}}
                              >🗑</button>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()}

          {/* ── Archived section ── */}
          {hasEvents&&dashEvents.some(e=>e.archived)&&(()=>{
            const archived=dashEvents.filter(e=>e.archived);
            return(
              <div style={{marginBottom:24,opacity:.65}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <span>🗄</span>
                  <span style={{fontSize:10,fontWeight:700,color:"#9ca3af",fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".18em"}}>Archivados</span>
                  <span style={{fontSize:10,color:"#cbd5e1",fontFamily:"IBM Plex Mono,monospace"}}>({archived.length})</span>
                  <div style={{flex:1,height:1,background:"linear-gradient(90deg,#9ca3af33,transparent)"}}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:8}}>
                  {archived.map(ev=>{
                    const kindIcon=ev.kind==="roadshow"?"🗺️":ev.kind==="outbound"?"✈️":"🏛";
                    return(
                      <div key={ev.id} style={{background:"#f9fafb",border:"1px solid #e9eef5",borderRadius:10,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}
                        onClick={()=>{setDashboardView(false);handleOpenEvent(ev.id);}}>
                        <span style={{fontSize:15,opacity:.4}}>{kindIcon}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:12,color:"#9ca3af",fontFamily:"Playfair Display,serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.name}</div>
                          {ev.dates&&<div style={{fontSize:9,color:"#d1d5db",fontFamily:"IBM Plex Mono,monospace"}}>{ev.dates}</div>}
                        </div>
                        <button style={{fontSize:9,padding:"2px 7px",border:"1px solid #e5e7eb",borderRadius:4,background:"#fff",color:"#1e5ab0",cursor:"pointer",flexShrink:0}}
                          title="Desarchivar" onClick={e=>{e.stopPropagation();const next=events.map(x=>x.id===ev.id?{...x,archived:false}:x);setEvents(next);saveEvents(next);cloudSaveEvent({...ev,archived:false});}}>
                          📂
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Create first event */}
          {!hasEvents&&(
          <div style={{marginBottom:48}}>
            <div style={{fontFamily:"Playfair Display,serif",fontSize:26,color:"var(--cream)",marginBottom:4,letterSpacing:".01em",textAlign:"center"}}>Latin Securities</div>
            <div style={{color:"var(--dim)",fontSize:12,marginBottom:48,fontFamily:"IBM Plex Mono,monospace",letterSpacing:".12em",textTransform:"uppercase",textAlign:"center"}}>Event Manager</div>
          </div>
          )}

          {/* Step 1: choose kind */}
          {!newEvKind&&(
          <div style={{maxWidth:640,width:"100%"}}>
            <div style={{textAlign:"center",fontSize:15,color:"var(--txt)",marginBottom:24}}>¿Qué tipo de evento querés crear?</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14,maxWidth:780}}>
              {[
                {kind:"conference",icon:"🏛",title:"Conferencia",subtitle:"Agenda con múltiples inversores y compañías. Carga Excel, genera reuniones automáticamente, exportá schedules por inversor/compañía.",color:"#1e5ab0"},
                {kind:"roadshow",icon:"🗺️",title:"Roadshow Inbound",subtitle:"Inversores visitan Argentina. Coordiná reuniones con compañías, calculá traslados y enviá agenda al cliente.",color:"#23a29e"},
                {kind:"outbound",icon:"✈️",title:"Roadshow Outbound",subtitle:"LS viaja a ver fondos en EEUU, Brasil, Europa, etc. Agenda multi-ciudad y multi-país.",color:"#e8850a"},
              ].map(opt=>(
                <div key={opt.kind} role="button" tabIndex={0}
                  onClick={()=>setNewEvKind(opt.kind)}
                  onKeyDown={e=>{if(e.key==="Enter")setNewEvKind(opt.kind);}}
                  style={{background:"#fff",border:`2px solid rgba(30,90,176,.12)`,borderRadius:14,padding:"28px 24px",cursor:"pointer",transition:"all .18s",textAlign:"center"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=opt.color;e.currentTarget.style.boxShadow=`0 6px 24px ${opt.color}22`;}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(30,90,176,.12)";e.currentTarget.style.boxShadow="none";}}>
                  <div style={{fontSize:40,marginBottom:12}}>{opt.icon}</div>
                  <div style={{fontFamily:"Playfair Display,serif",fontSize:18,color:"var(--cream)",marginBottom:8}}>{opt.title}</div>
                  <div style={{fontSize:12,color:"var(--dim)",lineHeight:1.65}}>{opt.subtitle}</div>
                </div>
              ))}
            </div>
          </div>
        )}

          {/* Step 2: name */}
          {newEvKind&&(
          <div style={{maxWidth:440,width:"100%"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:24}}>
              <button onClick={()=>setNewEvKind("")} style={{background:"none",border:"none",cursor:"pointer",color:"var(--dim)",fontSize:13,padding:"4px 8px",borderRadius:6,display:"flex",alignItems:"center",gap:5}}>← Volver</button>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:20}}>{newEvKind==="conference"?"🏛":"🗺️"}</span>
                <span style={{fontFamily:"Playfair Display,serif",fontSize:16,color:"var(--cream)"}}>{newEvKind==="conference"?"Nueva Conferencia":"Nuevo Roadshow"}</span>
              </div>
            </div>
            <div className="card">
              <div className="lbl" style={{marginBottom:8}}>Nombre del evento</div>
              <input className="inp" style={{marginBottom:14}} autoFocus
                placeholder={newEvKind==="conference"?"Ej: Argentina NY 2026":"Ej: Brasil Roadshow Abril 2026"}
                value={newEvName} onChange={e=>setNewEvName(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&newEvName.trim()&&createEvent(newEvName.trim(),newEvKind,newEvTemplate)}/>
              <button className="btn bg" style={{width:"100%",fontSize:13,padding:"10px"}}
                onClick={()=>newEvName.trim()&&createEvent(newEvName.trim(),newEvKind,newEvTemplate)}>
                Crear {newEvKind==="conference"?"conferencia":newEvKind==="outbound"?"roadshow outbound":"roadshow inbound"} →
              </button>
            </div>
          </div>
        )}
        </div>{/* maxWidth:900 */}
      </div>{/* outer */}

      {/* NEW EVENT MODAL — also needed inside dashboard return */}
      {showEvMgr&&(
        <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setShowEvMgr(false);}}>
          <div className="modal" style={{maxWidth:480}}>
            <div className="modal-hdr"><div className="modal-title">Nuevo evento</div></div>
            <div className="modal-body">
              <div style={{marginBottom:16}}>
                <div className="lbl" style={{marginBottom:8}}>Tipo de evento</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[["roadshow","🗺️","Inbound Roadshow"],["outbound","✈️","Outbound Roadshow"],["conference","🏛","Conferencia"]].map(([k,ic,lbl])=>(
                    <div key={k} onClick={()=>setNewEvKind(k)}
                      style={{padding:"14px 10px",border:`2px solid ${newEvKind===k?"#1e5ab0":"rgba(30,90,176,.15)"}`,borderRadius:10,cursor:"pointer",textAlign:"center",background:newEvKind===k?"rgba(30,90,176,.06)":"transparent",transition:"all .15s"}}>
                      <div style={{fontSize:24,marginBottom:5}}>{ic}</div>
                      <div style={{fontSize:11,color:"var(--cream)",fontWeight:600,lineHeight:1.3}}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
              {newEvKind&&(
                <div>
                  <div className="lbl" style={{marginBottom:6}}>Nombre del evento</div>
                  <input className="inp" value={newEvName} onChange={e=>setNewEvName(e.target.value)}
                    placeholder={newEvKind==="roadshow"?"Ej: IMP 2026":newEvKind==="outbound"?"Ej: US Roadshow 2Q26":"Ej: Argentina in NY 2026"}
                    onKeyDown={e=>e.key==="Enter"&&newEvName.trim()&&(createEvent(newEvName.trim(),newEvKind),setShowEvMgr(false))}
                    autoFocus style={{marginBottom:12}}/>
                  <button className="btn bg bs" style={{width:"100%",justifyContent:"center"}}
                    disabled={!newEvName.trim()}
                    onClick={()=>{if(newEvName.trim()){createEvent(newEvName.trim(),newEvKind);setShowEvMgr(false);setNewEvName("");setNewEvKind(null);}}}>
                    Crear evento →
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer"><button className="btn bo bs" onClick={()=>{setShowEvMgr(false);setNewEvName("");setNewEvKind(null);}}>Cancelar</button></div>
          </div>
        </div>
      )}

    {/* NEW EVENT MODAL */}
    {showEvMgr&&(
      <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setShowEvMgr(false);}}>
        <div className="modal" style={{maxWidth:440}}>
          <div className="modal-hdr"><div className="modal-title">Gestión de Eventos</div></div>
          <div className="modal-body">
            <div style={{marginBottom:16}}>
              <div className="lbl" style={{marginBottom:6}}>Tipo de evento</div>
              <div style={{display:"flex",gap:8,marginBottom:10}}>
                {[["conference","🏛 Conferencia"],["roadshow","🗺️ Inbound"],["outbound","✈️ Outbound"]].map(([k,l])=>(
                  <button key={k} className={`btn bs ${newEvKind===k?"bg":"bo"}`} style={{flex:1,fontSize:11}} onClick={()=>setNewEvKind(k)}>{l}</button>
                ))}
              </div>
              <div className="lbl" style={{marginBottom:4}}>Nombre del evento</div>
              <div className="flex" style={{marginTop:0}}>
                <input className="inp" style={{flex:1}} placeholder={newEvKind==="conference"?"Ej: Argentina NY 2026":newEvKind==="outbound"?"Ej: US Roadshow Q2 2026":"Ej: Brasil Roadshow Abril 2026"} value={newEvName} onChange={e=>setNewEvName(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&newEvName.trim()&&(createEvent(newEvName.trim(),newEvKind),setShowEvMgr(false))}/>
                <button className="btn bg bs" onClick={()=>{if(newEvName.trim()){createEvent(newEvName.trim(),newEvKind);setShowEvMgr(false);}}}>Crear</button>
              </div>
            </div>
            <div className="sec-hdr">Eventos existentes</div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>
              {events.map(e=>(
                <div key={e.id} className={`ev-card${e.id===activeEv?" active-ev":""}`}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{fontSize:13.5,color:"var(--cream)",fontFamily:"Playfair Display,serif"}}>{e.name}</div>
                      <span style={{fontSize:9,padding:"1px 6px",borderRadius:4,fontFamily:"IBM Plex Mono,monospace",background:e.kind==="roadshow"?"rgba(35,162,158,.15)":"rgba(30,90,176,.12)",color:e.kind==="roadshow"?"#23a29e":"var(--gold)",flexShrink:0}}>{e.kind==="roadshow"?"🗺️ Inbound":e.kind==="outbound"?"✈️ Outbound":"🏛 Conferencia"}</span>
                    </div>
                    <div style={{fontSize:10,color:"var(--dim)",marginTop:2}}>
                      {(e.investors||[]).length} inversores · {(e.meetings||e.roadshow?.meetings||[]).length} reuniones
                      {(e.activityLog||[]).length>0&&<span style={{marginLeft:6,color:"rgba(30,90,176,.4)"}}>· {(e.activityLog||[]).length} cambios</span>}
                    </div>
                  </div>
                  <button className="btn bo bs" onClick={()=>handleOpenEvent(e.id)}>Abrir</button>
                  <button className="btn bo bs" title="Duplicar (copia sin reuniones)" onClick={()=>duplicateEvent(e.id)}>⧉ Duplicar</button>
                  <button className="btn bo bs" title={e.passwordHash?"Cambiar contraseña":"Poner contraseña"} onClick={()=>{
                    setEvPasswordModal({evId:e.id,mode:"set"});setEvPasswordInput("");
                  }}>{e.passwordHash?"🔒":"🔓"}</button>
                  {events.length>1&&<button className="btn bd bs" title="Eliminar evento" onClick={()=>{
                    if(confirm(`Eliminar "${e.name}"? Esta acción no se puede deshacer.`)){
                      const next=events.filter(x=>x.id!==e.id);setEvents(next);saveEvents(next);cloudDeleteEvent(e.id);
                      if(activeEv===e.id) setActiveEv(next[0]?.id||null);
                    }
                  }}>🗑</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer"><button className="btn bo bs" onClick={()=>setShowEvMgr(false)}>Cerrar</button></div>
        </div>
      </div>
    )}

    {/* ── Password modal ── */}
    {evPasswordModal&&(
      <div className="overlay" onClick={e=>{if(e.target===e.currentTarget){setEvPasswordModal(null);evPasswordModal.resolve&&evPasswordModal.resolve(false);}}}>
        <div className="modal" style={{maxWidth:360}}>
          <div className="modal-hdr">
            <div className="modal-title">{evPasswordModal.mode==="check"?"🔒 Evento protegido":"🔒 Contraseña del evento"}</div>
          </div>
          <div className="modal-body">
            {evPasswordModal.mode==="check"?(
              <>
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:12}}>Este evento está protegido. Ingresá la contraseña para abrirlo.</p>
                <div className="lbl">Contraseña</div>
                <input className="inp" type="password" autoFocus value={evPasswordInput} onChange={e=>setEvPasswordInput(e.target.value)}
                  placeholder="Contraseña..."
                  onKeyDown={async e=>{if(e.key==="Enter"){const hash=await hashPwd(evPasswordInput);const ev=events.find(x=>x.id===evPasswordModal.evId);const ok=ev?.passwordHash===hash;setEvPasswordModal(null);evPasswordModal.resolve(ok);if(!ok)alert("Contraseña incorrecta.");}}}/>
              </>
            ):(
              <>
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:12}}>Ingresá una contraseña para proteger este evento. Dejá vacío para quitar la contraseña.</p>
                <div className="lbl">Nueva contraseña</div>
                <input className="inp" type="password" autoFocus value={evPasswordInput} onChange={e=>setEvPasswordInput(e.target.value)} placeholder="Dejar vacío para quitar..."/>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn bo bs" onClick={()=>{setEvPasswordModal(null);evPasswordModal.resolve&&evPasswordModal.resolve(false);}}>Cancelar</button>
            {evPasswordModal.mode==="check"?(
              <button className="btn bg bs" onClick={async()=>{const hash=await hashPwd(evPasswordInput);const ev=events.find(x=>x.id===evPasswordModal.evId);const ok=ev?.passwordHash===hash;setEvPasswordModal(null);evPasswordModal.resolve(ok);if(!ok)alert("Contraseña incorrecta.");}}>Abrir</button>
            ):(
              <button className="btn bg bs" onClick={()=>{setEvPassword(evPasswordModal.evId,evPasswordInput);setEvPasswordModal(null);}}>Guardar</button>
            )}
          </div>
        </div>
      </div>
    )}

    {/* ── Global Search Modal ── */}
    </div>
  );
}
