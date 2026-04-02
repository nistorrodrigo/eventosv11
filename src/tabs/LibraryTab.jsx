// ── LibraryTab.jsx — Librería Global (companies, investors, CRM Fondos) ─
import { useState } from "react";
import { downloadBlob } from "../storage.jsx";
import * as XLSX from "xlsx";

export function LibraryTab({
  globalDB, saveGlobalDB, events,
  dbTab, setDbTab,
  coSearch, setCoSearch, invSearch, setInvSearch,
  editCo, setEditCo, editInv, setEditInv,
  crmSearch, setCrmSearch, crmFund, setCrmFund,
  dbCoExcelRef, dbInvExcelRef, downloadDBTemplate,
}){
        const dbCos=globalDB.companies||[];
        const dbInvs=globalDB.investors||[];


        const filteredCos=dbCos.filter(c=>!coSearch||c.name.toLowerCase().includes(coSearch.toLowerCase())||c.ticker.toLowerCase().includes(coSearch.toLowerCase())||c.sector.toLowerCase().includes(coSearch.toLowerCase()));
        const filteredInvs=dbInvs.filter(i=>!invSearch||i.name.toLowerCase().includes(invSearch.toLowerCase())||(i.fund||"").toLowerCase().includes(invSearch.toLowerCase())||(i.email||"").toLowerCase().includes(invSearch.toLowerCase()));

        function saveCo(co){const db={...globalDB,companies:globalDB.companies.map(c=>c.id===co.id?co:c)};saveGlobalDB(db);setEditCo(null);}
        function addCo(){const nc={id:`dbc_${Date.now()}`,name:"",ticker:"",sector:"Other",hqAddress:"",contacts:[]};saveGlobalDB({...globalDB,companies:[...globalDB.companies,nc]});setEditCo(nc.id);}
        function delCo(id){if(confirm("¿Eliminar esta compañía de la librería?"))saveGlobalDB({...globalDB,companies:globalDB.companies.filter(c=>c.id!==id)});}
        function saveInv(inv){const db={...globalDB,investors:globalDB.investors.map(i=>i.id===inv.id?inv:i)};saveGlobalDB(db);setEditInv(null);}
        function addInv(){const ni={id:`dbi_${Date.now()}`,name:"",fund:"",position:"",email:"",phone:"",aum:"",companies:[],linkedin:"",notes:""};saveGlobalDB({...globalDB,investors:[...globalDB.investors,ni]});setEditInv(ni.id);}
        function delInv(id){if(confirm("¿Eliminar este inversor de la librería?"))saveGlobalDB({...globalDB,investors:globalDB.investors.filter(i=>i.id!==id)});}

        const SECTORS=["Financials","Energy","Infra","Real Estate","TMT","LS","Other"];

        return(
        <div>
          <h2 className="pg-h">📚 Librería Global</h2>
          <p className="pg-s">Base de datos centralizada de compañías, representantes e inversores. Compartida entre todos los eventos.</p>

          {/* Sub-tabs */}
          <div style={{display:"flex",gap:0,marginBottom:16,borderBottom:"1px solid rgba(30,90,176,.1)"}}>
            {[["companies",`🏢 Compañías (${dbCos.length})`],["investors",`👥 Inversores (${dbInvs.length})`],["fondos","📊 CRM Fondos"]].map(([id,lbl])=>(
              <button key={id} className={`ntab${dbTab===id?" on":""}`} style={{height:38,fontSize:10}} onClick={()=>setDbTab(id)}>{lbl}</button>
            ))}
          </div>

          {/* ── COMPANIES ── */}
          {dbTab==="companies"&&(
            <div>
              {/* Toolbar */}
              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                <input className="inp" style={{flex:1,minWidth:200,fontSize:12}} value={coSearch} onChange={e=>setCoSearch(e.target.value)} placeholder="🔍 Buscar por nombre, ticker o sector..."/>
                <button className="btn bg bs" style={{gap:5,fontSize:11}} onClick={addCo}>+ Agregar</button>
                <button className="btn bo bs" style={{gap:5,fontSize:11}} onClick={()=>dbCoExcelRef.current?.click()}>📥 Importar Excel</button>
                <button className="btn bo bs" style={{gap:5,fontSize:11}} onClick={()=>downloadDBTemplate("companies")}>📋 Plantilla</button>
              </div>

              {/* Format hint */}
              <div style={{background:"rgba(30,90,176,.04)",border:"1px solid rgba(30,90,176,.12)",borderRadius:7,padding:"10px 14px",marginBottom:12,fontSize:11,color:"var(--dim)",lineHeight:1.8}}>
                <strong style={{color:"var(--cream)"}}>📋 Formato Excel para importar compañías:</strong><br/>
                Columnas: <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>Name</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>Ticker</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>Sector</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>HQ Address</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>Contact 1</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>Title 1</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>Email 1</code> · <code style={{background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3,opacity:.7}}>Phone 1 (opt.)</code> · Contact 2, Email 2... hasta 3 contactos por empresa.
                {" "}<button className="btn bo bs" style={{fontSize:9,padding:"2px 8px",marginLeft:6}} onClick={()=>downloadDBTemplate("companies")}>Descargar plantilla →</button>
              </div>

              {/* Company list */}
              <div style={{display:"grid",gap:8}}>
                {filteredCos.map(co=>{
                  const isEdit=editCo===co.id;
                  const working=isEdit?co:co;
                  const clr=SEC_CLR[co.sector]||"#666";
                  return(
                    <div key={co.id} style={{border:`1px solid ${isEdit?"rgba(30,90,176,.3)":"rgba(30,90,176,.1)"}`,borderRadius:9,padding:"12px 14px",background:isEdit?"rgba(30,90,176,.03)":"#fff",transition:"all .15s"}}>
                      {!isEdit?(
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{width:38,height:38,borderRadius:7,background:clr,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontFamily:"IBM Plex Mono,monospace",fontSize:9,fontWeight:700,flexShrink:0,textAlign:"center",lineHeight:1.2}}>{co.ticker||"?"}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:7}}>
                              <span style={{fontSize:13,fontWeight:700,color:"var(--cream)"}}>{co.name||"Sin nombre"}</span>
                              <span style={{fontSize:9,padding:"1px 6px",borderRadius:4,background:`${clr}22`,color:clr,fontFamily:"IBM Plex Mono,monospace"}}>{co.sector}</span>
                            </div>
                            <div style={{fontSize:10,color:"var(--dim)",marginTop:2,display:"flex",gap:12,flexWrap:"wrap"}}>
                              {co.hqAddress&&<span>📍 {co.hqAddress}</span>}
                              
                              <span style={{color:"var(--gold)"}}>{co.contacts?.length||0} contacto(s)</span>
                            </div>
                            {(co.contacts||[]).length>0&&(
                              <div style={{marginTop:6,display:"flex",gap:6,flexWrap:"wrap"}}>
                                {co.contacts.map(r=>(
                                  <div key={r.id} style={{fontSize:10,background:"rgba(30,90,176,.06)",borderRadius:5,padding:"2px 8px",color:"var(--txt)"}}>
                                    <strong>{r.name}</strong>{r.title?` · ${r.title}`:""}{r.email?` · ${r.email}`:""}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{display:"flex",gap:5,flexShrink:0}}>
                            <button className="btn bo bs" style={{fontSize:9,padding:"3px 9px"}} onClick={()=>setEditCo(co.id)}>✏️ Editar</button>
                            <button aria-label="Eliminar" className="btn bd bs" style={{fontSize:9,padding:"3px 7px"}} onClick={()=>delCo(co.id)}>✕</button>
                          </div>
                        </div>
                      ):(
                        <div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:10}}>
                            <div><div className="lbl" style={{marginBottom:2}}>Nombre *</div><input className="inp" style={{fontSize:11}} value={co.name} placeholder="Banco Macro" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,name:e.target.value}:c);saveGlobalDB({...globalDB,companies:nc});}}/></div>
                            <div><div className="lbl" style={{marginBottom:2}}>Ticker</div><input className="inp" style={{fontSize:11,fontFamily:"IBM Plex Mono,monospace"}} value={co.ticker} placeholder="BMA" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,ticker:e.target.value.toUpperCase()}:c);saveGlobalDB({...globalDB,companies:nc});}}/></div>
                            <div><div className="lbl" style={{marginBottom:2}}>Sector</div>
                              <select className="sel" style={{fontSize:11}} value={co.sector} onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,sector:e.target.value}:c);saveGlobalDB({...globalDB,companies:nc});}}>
                                {SECTORS.map(s=><option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                          <div style={{marginBottom:10}}><div className="lbl" style={{marginBottom:2}}>Dirección HQ</div><input className="inp" style={{fontSize:11}} value={co.hqAddress||""} placeholder="Av. Eduardo Madero 1182, CABA" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,hqAddress:e.target.value}:c);saveGlobalDB({...globalDB,companies:nc});}}/></div>
                          {/* Contacts */}
                          <div style={{marginBottom:10}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                              <div className="lbl" style={{margin:0}}>👤 Representantes</div>
                              <button className="btn bo bs" style={{fontSize:9,padding:"2px 8px"}} onClick={()=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,contacts:[...(c.contacts||[]),{id:`rep_${Date.now()}`,name:"",title:"",email:"",phone:""}]}:c);saveGlobalDB({...globalDB,companies:nc});}}>+ Add</button>
                            </div>
                            {(co.contacts||[]).map((rep,ri)=>(
                              <div key={rep.id||ri} style={{display:"grid",gridTemplateColumns:"2fr 1.5fr 2fr 1fr auto",gap:5,marginBottom:5,alignItems:"center"}}>
                                <input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={rep.name||""} placeholder="Nombre *" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,contacts:c.contacts.map((r,j)=>j===ri?{...r,name:e.target.value}:r)}:c);saveGlobalDB({...globalDB,companies:nc});}}/>
                                <input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={rep.title||""} placeholder="Cargo" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,contacts:c.contacts.map((r,j)=>j===ri?{...r,title:e.target.value}:r)}:c);saveGlobalDB({...globalDB,companies:nc});}}/>
                                <input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={rep.email||""} placeholder="email@empresa.com" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,contacts:c.contacts.map((r,j)=>j===ri?{...r,email:e.target.value}:r)}:c);saveGlobalDB({...globalDB,companies:nc});}}/>
                                <input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={rep.phone||""} placeholder="Tel. (opcional)" onChange={e=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,contacts:c.contacts.map((r,j)=>j===ri?{...r,phone:e.target.value}:r)}:c);saveGlobalDB({...globalDB,companies:nc});}}/>
                                <button aria-label="Eliminar rep" style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:13,padding:"0 4px"}} onClick={()=>{const nc=globalDB.companies.map(c=>c.id===co.id?{...c,contacts:c.contacts.filter((_,j)=>j!==ri)}:c);saveGlobalDB({...globalDB,companies:nc});}}>✕</button>
                              </div>
                            ))}
                            {!(co.contacts||[]).length&&<div style={{fontSize:10,color:"var(--dim)"}}>Sin representantes — clic en + Add</div>}
                          </div>
                          <div style={{display:"flex",gap:6}}>
                            <button className="btn bg bs" style={{fontSize:10}} onClick={()=>setEditCo(null)}>✓ Guardar</button>
                            <button className="btn bo bs" style={{fontSize:10}} onClick={()=>setEditCo(null)}>Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!filteredCos.length&&(
                  <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)"}}>
                    <div style={{fontSize:36,marginBottom:8}}>🏢</div>
                    <div style={{fontSize:14,color:"var(--cream)",marginBottom:6}}>{coSearch?"Sin resultados para tu búsqueda":"Librería de compañías vacía"}</div>
                    <div style={{fontSize:12}}>Usá + Agregar o 📥 Importar Excel para cargar compañías con sus representantes.</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── CRM FONDOS ── */}
          {dbTab==="fondos"&&(()=>{
            // Aggregate all meetings across all events by fund name
            const INTEREST_LABELS=["","💤 Sin interés","😐 Bajo","👍 Medio","😃 Interesado","🔥 Muy interesado"];
            const INTEREST_EMOJI=["","💤","😐","👍","😃","🔥"];
            const NEXT_LABELS={"follow_up_call":"📞 Follow-up","send_materials":"📄 Materiales","meeting_again":"🔁 Repetir","monitor":"👁 Monitor","no_interest":"❌ Sin interés"};
            const RS_CLR_CRM={"Financials":"#1e5ab0","Energy":"#e8850a","Utilities":"#23a29e","TMT":"#7c3aed","Infra":"#059669","Industry":"#b45309","Consumer":"#dc2626","Agro":"#65a30d","Exchange":"#0891b2","Real Estate":"#d97706","Other":"#6b7280"};

            // Build fund → meetings map across all events
            const fundMap={};
            events.forEach(ev=>{
              const kind=ev.kind||"conference";
              // Inbound roadshow
              if(kind==="roadshow"&&ev.roadshow){
                const trip=ev.roadshow.trip||{};
                const fund=trip.fund||trip.clientName||"";
                if(!fund) return;
                if(!fundMap[fund]) fundMap[fund]={fund,events:[],meetings:[],feedbacks:[],companies:new Set(),sectors:new Set()};
                (ev.roadshow.meetings||[]).forEach(m=>{
                  if(m.status==="cancelled") return;
                  const coMap=new Map((ev.roadshow.companies||[]).map(c=>[c.id,c]));
                  const co=m.type==="company"?coMap.get(m.companyId):null;
                  fundMap[fund].meetings.push({evName:ev.name,evId:ev.id,date:m.date,hour:m.hour,status:m.status,coName:co?.name,coTicker:co?.ticker,sector:co?.sector,notes:m.notes,postNotes:m.postNotes,feedback:m.feedback,kind});
                  if(co?.sector) fundMap[fund].sectors.add(co.sector);
                  if(co?.name) fundMap[fund].companies.add(co.name);
                  if(m.feedback?.interestLevel) fundMap[fund].feedbacks.push(m.feedback.interestLevel);
                });
                if(!fundMap[fund].events.find(e=>e.id===ev.id)) fundMap[fund].events.push({id:ev.id,name:ev.name,kind,dates:(trip.arrivalDate||"")+(trip.departureDate?" – "+trip.departureDate:"")});
              }
              // Outbound
              if(kind==="outbound"&&ev.outbound){
                (ev.outbound.destinations||[]).forEach(dest=>{
                  (dest.meetings||[]).forEach(m=>{
                    if(m.status==="cancelled") return;
                    const fund=m.fund||"";
                    if(!fund) return;
                    if(!fundMap[fund]) fundMap[fund]={fund,events:[],meetings:[],feedbacks:[],companies:new Set(),sectors:new Set()};
                    fundMap[fund].meetings.push({evName:ev.name,evId:ev.id,date:m.date,hour:m.hour,status:m.status,coName:m.fund,location:m.location,notes:m.notes,feedback:m.feedback,kind,city:dest.city});
                    if(m.feedback?.interestLevel) fundMap[fund].feedbacks.push(m.feedback.interestLevel);
                    if(!fundMap[fund].events.find(e=>e.id===ev.id)) fundMap[fund].events.push({id:ev.id,name:ev.name,kind});
                  });
                });
              }
            });

            const allFunds=Object.values(fundMap).sort((a,b)=>{
              // Sort by avg interest desc, then by most recent meeting
              const avgA=a.feedbacks.length?a.feedbacks.reduce((s,v)=>s+v,0)/a.feedbacks.length:0;
              const avgB=b.feedbacks.length?b.feedbacks.reduce((s,v)=>s+v,0)/b.feedbacks.length:0;
              if(avgB!==avgA) return avgB-avgA;
              const lastA=a.meetings.map(m=>m.date).sort().reverse()[0]||"";
              const lastB=b.meetings.map(m=>m.date).sort().reverse()[0]||"";
              return lastB.localeCompare(lastA);
            });

            const filteredFunds=crmSearch?allFunds.filter(f=>f.fund.toLowerCase().includes(crmSearch.toLowerCase())):allFunds;

            // Detail view for a selected fund
            if(crmFund){
              const fd=fundMap[crmFund];
              if(!fd) return null;
              const sortedMtgs=[...fd.meetings].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
              const avgInterest=fd.feedbacks.length?Math.round(fd.feedbacks.reduce((s,v)=>s+v,0)/fd.feedbacks.length*10)/10:null;
              const allTopics={};
              fd.meetings.forEach(m=>{(m.feedback?.topics||[]).forEach(t=>{allTopics[t]=(allTopics[t]||0)+1;});});
              const topTopics=Object.entries(allTopics).sort((a,b)=>b[1]-a[1]).slice(0,5);
              const nextSteps={};
              fd.meetings.forEach(m=>{if(m.feedback?.nextStep){nextSteps[m.feedback.nextStep]=(nextSteps[m.feedback.nextStep]||0)+1;}});
              const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h%1)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
              return(
                <div>
                  <button className="btn bo bs" style={{fontSize:10,marginBottom:16}} onClick={()=>setCrmFund(null)}>← Volver</button>
                  <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:240}}>
                      <h2 style={{fontFamily:"Playfair Display,serif",fontSize:22,color:"var(--navy)",marginBottom:4}}>{fd.fund}</h2>
                      <div style={{fontSize:11,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>
                        {fd.events.length} evento(s) · {fd.meetings.length} reunión(es) · {[...fd.companies].length} empresa(s)
                      </div>
                    </div>
                    {avgInterest&&<div style={{textAlign:"center",padding:"12px 20px",background:"rgba(30,90,176,.05)",borderRadius:10,border:"1px solid rgba(30,90,176,.1)"}}>
                      <div style={{fontSize:28}}>{INTEREST_EMOJI[Math.round(avgInterest)]}</div>
                      <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:11,color:"var(--dim)"}}>Interés prom.</div>
                      <div style={{fontWeight:700,color:"var(--navy)"}}>{avgInterest}/5</div>
                    </div>}
                  </div>

                  {/* Topics & next steps */}
                  {(topTopics.length>0||Object.keys(nextSteps).length>0)&&(
                    <div style={{display:"flex",gap:16,marginBottom:20,flexWrap:"wrap"}}>
                      {topTopics.length>0&&<div style={{flex:1,minWidth:200,background:"#f9fafb",border:"1px solid #e9eef5",borderRadius:8,padding:"12px 14px"}}>
                        <div style={{fontSize:9,fontFamily:"IBM Plex Mono,monospace",color:"var(--dim)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>Temas más discutidos</div>
                        {topTopics.map(([t,c])=>(
                          <div key={t} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                            <span style={{fontSize:11,color:"var(--txt)"}}>{t}</span>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <div style={{height:4,width:c*16,background:"#1e5ab0",borderRadius:2}}/>
                              <span style={{fontSize:10,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>{c}</span>
                            </div>
                          </div>
                        ))}
                      </div>}
                      {Object.keys(nextSteps).length>0&&<div style={{flex:1,minWidth:200,background:"#f9fafb",border:"1px solid #e9eef5",borderRadius:8,padding:"12px 14px"}}>
                        <div style={{fontSize:9,fontFamily:"IBM Plex Mono,monospace",color:"var(--dim)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>Próximos pasos históricos</div>
                        {Object.entries(nextSteps).map(([ns,c])=>(
                          <div key={ns} style={{fontSize:11,color:"var(--txt)",marginBottom:4}}>{NEXT_LABELS[ns]||ns} <span style={{color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>×{c}</span></div>
                        ))}
                      </div>}
                    </div>
                  )}

                  {/* Meeting timeline */}
                  <div style={{fontSize:10,fontFamily:"IBM Plex Mono,monospace",color:"var(--dim)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Historial de reuniones</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {sortedMtgs.map((m,i)=>{
                      const isConf=m.status==="confirmed";
                      const fb=m.feedback||{};
                      const clr=RS_CLR_CRM[m.sector]||"#6b7280";
                      return(
                        <div key={i} style={{background:"#fff",border:"1px solid #e9eef5",borderRadius:10,padding:"12px 14px",display:"flex",gap:12,alignItems:"flex-start",position:"relative",overflow:"hidden"}}>
                          <div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:clr}}/>
                          <div style={{minWidth:110,flexShrink:0}}>
                            <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:11,fontWeight:700,color:"var(--navy)"}}>{m.date?new Date(m.date+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"short",year:"numeric"}):"Sin fecha"}</div>
                            {m.hour&&<div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:10,color:"var(--dim)"}}>{fmtH(m.hour)}</div>}
                            <div style={{fontSize:9,marginTop:3,color:isConf?"#166534":"#b45309",fontFamily:"IBM Plex Mono,monospace"}}>{isConf?"✓ Conf.":"◌ Tent."}</div>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:4,flexWrap:"wrap"}}>
                              {m.coName&&<span style={{fontWeight:600,color:"var(--navy)",fontSize:13}}>{m.coName}{m.coTicker?` (${m.coTicker})`:""}</span>}
                              {m.sector&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:3,background:clr+"22",color:clr,fontFamily:"IBM Plex Mono,monospace"}}>{m.sector}</span>}
                              {m.city&&<span style={{fontSize:9,color:"var(--dim)"}}>📍{m.city}</span>}
                            </div>
                            <div style={{fontSize:10,color:"var(--dim)",marginBottom:3}}>📅 {m.evName}</div>
                            {m.notes&&<div style={{fontSize:10,color:"var(--dim)",lineHeight:1.5}}>📋 {m.notes.slice(0,120)}{m.notes.length>120?"…":""}</div>}
                            {m.postNotes&&<div style={{fontSize:10,color:"#166534",marginTop:2,lineHeight:1.5}}>✅ {m.postNotes.slice(0,120)}{m.postNotes.length>120?"…":""}</div>}
                            {fb.topics?.length>0&&<div style={{marginTop:4,display:"flex",gap:3,flexWrap:"wrap"}}>{fb.topics.map(t=><span key={t} style={{fontSize:9,padding:"1px 7px",borderRadius:10,background:"rgba(30,90,176,.07)",color:"#1e5ab0"}}>{t}</span>)}</div>}
                          </div>
                          {fb.interestLevel&&<div style={{flexShrink:0,fontSize:22,lineHeight:1}} title={INTEREST_LABELS[fb.interestLevel]}>{INTEREST_EMOJI[fb.interestLevel]}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // List view
            return(
              <div>
                <div style={{display:"flex",gap:8,marginBottom:14,alignItems:"center"}}>
                  <input className="inp" value={crmSearch} onChange={e=>setCrmSearch(e.target.value)}
                    placeholder="Buscar fondo..." style={{flex:1,fontSize:12}}/>
                  <div style={{fontSize:11,color:"var(--dim)",whiteSpace:"nowrap",fontFamily:"IBM Plex Mono,monospace"}}>{filteredFunds.length} fondos</div>
                </div>
                {filteredFunds.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)"}}>
                  {events.length===0?"No hay eventos cargados.":crmSearch?"Sin resultados para "+JSON.stringify(crmSearch)+".":"No hay reuniones con feedback cargadas aún."}
                </div>}
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {filteredFunds.map(fd=>{
                    const avgInterest=fd.feedbacks.length?Math.round(fd.feedbacks.reduce((s,v)=>s+v,0)/fd.feedbacks.length*10)/10:null;
                    const lastDate=[...fd.meetings].sort((a,b)=>(b.date||"").localeCompare(a.date||""))[0]?.date;
                    const lastDateFmt=lastDate?new Date(lastDate+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"short",year:"numeric"}):"Sin fecha";
                    return(
                      <div key={fd.fund} onClick={()=>setCrmFund(fd.fund)}
                        style={{background:"#fff",border:"1px solid #e9eef5",borderRadius:10,padding:"12px 16px",cursor:"pointer",display:"flex",gap:12,alignItems:"center",transition:"all .12s",boxShadow:"0 1px 3px rgba(0,0,57,.03)"}}
                        onMouseEnter={e=>{e.currentTarget.style.borderColor="#1e5ab0";e.currentTarget.style.boxShadow="0 3px 12px rgba(30,90,176,.1)";}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor="#e9eef5";e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,57,.03)";}}>
                        {/* Avg interest */}
                        <div style={{width:40,textAlign:"center",flexShrink:0}}>
                          {avgInterest?(
                            <div style={{fontSize:22}}>{INTEREST_EMOJI[Math.round(avgInterest)]}</div>
                          ):(
                            <div style={{width:32,height:32,borderRadius:"50%",background:"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,margin:"0 auto"}}>?</div>
                          )}
                        </div>
                        {/* Fund info */}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:700,color:"var(--navy)",fontSize:14,fontFamily:"Playfair Display,serif",marginBottom:2}}>{fd.fund}</div>
                          <div style={{fontSize:10,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace",display:"flex",gap:10,flexWrap:"wrap"}}>
                            <span>{fd.meetings.length} reunión(es)</span>
                            <span>{fd.events.length} evento(s)</span>
                            {lastDate&&<span>Última: {lastDateFmt}</span>}
                          </div>
                          {[...fd.companies].length>0&&<div style={{fontSize:10,color:"var(--dim)",marginTop:2}}>
                            {[...fd.companies].slice(0,3).join(" · ")}{[...fd.companies].length>3?` +${[...fd.companies].length-3} más`:""}
                          </div>}
                        </div>
                        {/* Avg interest number */}
                        {avgInterest&&<div style={{textAlign:"right",flexShrink:0}}>
                          <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:13,fontWeight:700,color:"var(--navy)"}}>{avgInterest}/5</div>
                          <div style={{fontSize:8,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>prom. interés</div>
                        </div>}
                        <div style={{color:"var(--dim)",fontSize:16,flexShrink:0}}>›</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* ── INVESTORS ── */}
          {dbTab==="investors"&&(
            <div>
              {/* Toolbar */}
              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                <input className="inp" style={{flex:1,minWidth:200,fontSize:12}} value={invSearch} onChange={e=>setInvSearch(e.target.value)} placeholder="🔍 Buscar por nombre, fondo o email..."/>
                <button className="btn bg bs" style={{gap:5,fontSize:11}} onClick={addInv}>+ Agregar</button>
                <button className="btn bo bs" style={{gap:5,fontSize:11}} onClick={()=>dbInvExcelRef.current?.click()}>📥 Importar Excel</button>
                <button className="btn bo bs" style={{gap:5,fontSize:11}} onClick={()=>downloadDBTemplate("investors")}>📋 Plantilla</button>
              </div>

              {/* Format hint */}
              <div style={{background:"rgba(35,162,158,.04)",border:"1px solid rgba(35,162,158,.15)",borderRadius:7,padding:"10px 14px",marginBottom:12,fontSize:11,color:"var(--dim)",lineHeight:1.8}}>
                <strong style={{color:"var(--cream)"}}>📋 Formato Excel para importar inversores:</strong><br/>
                Columnas: <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Name</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Fund</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Position</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Email</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Phone</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>AUM</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Companies</code> (separadas por ;) · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>LinkedIn</code> · <code style={{background:"rgba(35,162,158,.1)",padding:"1px 5px",borderRadius:3}}>Notes</code>
                {" "}<button className="btn bo bs" style={{fontSize:9,padding:"2px 8px",marginLeft:6}} onClick={()=>downloadDBTemplate("investors")}>Descargar plantilla →</button>
              </div>

              {/* Investor list */}
              <div style={{overflowX:"auto",borderRadius:8,border:"1px solid rgba(30,90,176,.1)",boxShadow:"0 1px 4px rgba(30,90,176,.05)"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr style={{background:"rgba(35,162,158,.06)"}}>
                    {["Nombre","Fondo","Cargo","Email","Teléfono","AUM","Empresas de interés","",""].map(h=>(
                      <th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:9,fontFamily:"IBM Plex Mono,monospace",color:"var(--dim)",borderBottom:"1px solid rgba(35,162,158,.15)",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredInvs.map((inv,ii)=>{
                      const isEdit=editInv===inv.id;
                      return(
                        <tr key={inv.id} style={{borderBottom:"1px solid rgba(30,90,176,.04)",background:isEdit?"rgba(35,162,158,.04)":ii%2===0?"rgba(30,90,176,.01)":"transparent"}}>
                          {!isEdit?(<>
                            <td style={{padding:"7px 10px",fontWeight:700,color:"var(--cream)",whiteSpace:"nowrap"}}>{inv.name}</td>
                            <td style={{padding:"7px 10px",color:"var(--txt)"}}>{inv.fund}</td>
                            <td style={{padding:"7px 10px",color:"var(--dim)",fontSize:10}}>{inv.position}</td>
                            <td style={{padding:"7px 10px",fontFamily:"IBM Plex Mono,monospace",fontSize:10,color:"var(--txt)"}}>{inv.email}</td>
                            <td style={{padding:"7px 10px",fontSize:10,color:"var(--dim)"}}>{inv.phone}</td>
                            <td style={{padding:"7px 10px",fontSize:10,color:"var(--dim)"}}>{inv.aum}</td>
                            <td style={{padding:"7px 10px",maxWidth:200}}>
                              <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                                {(inv.companies||[]).map(c=><span key={c} style={{fontSize:9,background:"rgba(30,90,176,.08)",borderRadius:3,padding:"1px 5px",color:"var(--gold)"}}>{c}</span>)}
                              </div>
                            </td>
                            <td style={{padding:"7px 10px"}}><button className="btn bo bs" style={{fontSize:9,padding:"2px 8px",whiteSpace:"nowrap"}} onClick={()=>setEditInv(inv.id)}>✏️ Editar</button></td>
                            <td style={{padding:"7px 10px"}}><button aria-label="Eliminar" className="btn bd bs" style={{fontSize:9,padding:"2px 6px"}} onClick={()=>delInv(inv.id)}>✕</button></td>
                          </>):(<>
                            <td colSpan={9} style={{padding:"10px 12px"}}>
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr",gap:6,marginBottom:7}}>
                                {[["Nombre","name",""],["Fondo","fund",""],["Cargo","position","Portfolio Manager"],["Email","email",""],["Teléfono","phone",""],["AUM","aum","$2B"]].map(([lbl,f,ph])=>(
                                  <div key={f}><div className="lbl" style={{marginBottom:2,fontSize:9}}>{lbl}</div>
                                    <input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={inv[f]||""} placeholder={ph} onChange={e=>{const ni=globalDB.investors.map(i=>i.id===inv.id?{...i,[f]:e.target.value}:i);saveGlobalDB({...globalDB,investors:ni});}}/></div>
                                ))}
                              </div>
                              <div style={{marginBottom:7}}><div className="lbl" style={{marginBottom:2,fontSize:9}}>Empresas de interés (separadas por ;)</div>
                                <input className="inp" style={{fontSize:10,padding:"3px 7px",width:"100%"}} value={(inv.companies||[]).join("; ")} placeholder="YPF; Pampa; Galicia"
                                  onChange={e=>{const cos=e.target.value.split(";").map(s=>s.trim()).filter(Boolean);const ni=globalDB.investors.map(i=>i.id===inv.id?{...i,companies:cos}:i);saveGlobalDB({...globalDB,investors:ni});}}/></div>
                              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:7}}>
                                <div><div className="lbl" style={{marginBottom:2,fontSize:9}}>LinkedIn</div><input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={inv.linkedin||""} placeholder="linkedin.com/in/..." onChange={e=>{const ni=globalDB.investors.map(i=>i.id===inv.id?{...i,linkedin:e.target.value}:i);saveGlobalDB({...globalDB,investors:ni});}}/></div>
                                <div><div className="lbl" style={{marginBottom:2,fontSize:9}}>Notas</div><input className="inp" style={{fontSize:10,padding:"3px 7px"}} value={inv.notes||""} placeholder="Perfil, intereses..." onChange={e=>{const ni=globalDB.investors.map(i=>i.id===inv.id?{...i,notes:e.target.value}:i);saveGlobalDB({...globalDB,investors:ni});}}/></div>
                              </div>
                              <div style={{display:"flex",gap:6}}>
                                <button className="btn bg bs" style={{fontSize:10}} onClick={()=>setEditInv(null)}>✓ Guardar</button>
                                <button className="btn bo bs" style={{fontSize:10}} onClick={()=>setEditInv(null)}>Cancelar</button>
                              </div>
                            </td>
                          </>)}
                        </tr>
                      );
                    })}
                    {!filteredInvs.length&&(
                      <tr><td colSpan={9} style={{padding:"40px 20px",textAlign:"center",color:"var(--dim)"}}>
                        <div style={{fontSize:32,marginBottom:8}}>👥</div>
                        <div style={{fontSize:13,color:"var(--cream)",marginBottom:4}}>{invSearch?"Sin resultados":"Librería de inversores vacía"}</div>
                        <div style={{fontSize:11}}>Usá + Agregar o 📥 Importar Excel para cargar inversores.</div>
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{marginTop:10,fontSize:10,color:"var(--dim)",lineHeight:1.7}}>
                💡 <strong>Tip:</strong> Los inversores de la librería se usan como base de datos de referencia. Al cargar el Excel de una conferencia, los datos (email, fondo, cargo) se combinan automáticamente.
              </div>
            </div>
          )}
        </div>
        );
}
