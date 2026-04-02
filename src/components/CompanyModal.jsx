// ── CompanyModal.jsx ──
import { useState } from "react";
import { SEC_CLR, getDayIds, getDayShort, slotDay, slotLabel } from "../constants.jsx";

export function CompanyModal({co,meetings,investors,allSlots,onUpdateCo,onExport,invById,onClose}){
  const [activeTab,setActiveTab]=useState("info");
  const [newName,setNewName]=useState("");const [newTitle,setNewTitle]=useState("");
  const coMeetings=meetings.filter(m=>m.coId===co.id).sort((a,b)=>allSlots.indexOf(a.slotId)-allSlots.indexOf(b.slotId));
  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:600}}>
        <div className="modal-hdr">
          <div style={{display:"flex",alignItems:"baseline",gap:10}}>
            <div className="modal-title">{co.name}</div><span className="bdg bg-g">{co.ticker}</span>
          </div>
          <div className="modal-sub" style={{color:SEC_CLR[co.sector]}}>{co.sector}</div>
          <div className="modal-tabs" style={{marginTop:14}}>
            {[["info","🏢 Info"],["attendees","👤 Asistentes"],["meetings","📅 Reuniones"]].map(([t,l])=>(
              <button key={t} className={`mtab${activeTab===t?" on":""}`} onClick={()=>setActiveTab(t)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="modal-body">
          {activeTab==="info"&&(
            <div><div className="g2" style={{gap:12}}>
              {[["name","Nombre"],["ticker","Ticker"],["sector","Sector"]].map(([f,label])=>(
                <div key={f}><div className="lbl">{label}</div>
                  <input className="inp" value={co[f]||""} onChange={e=>onUpdateCo({...co,[f]:e.target.value})}/></div>
              ))}
            </div>
            <div style={{marginTop:14,padding:12,background:"var(--ink3)",borderRadius:7,fontSize:12,color:"var(--dim)"}}>
              <strong style={{color:"var(--txt)"}}>Reuniones:</strong> {coMeetings.length} · <strong style={{color:"var(--txt)"}}>Inversores únicos:</strong> {new Set(coMeetings.flatMap(m=>m.invIds)).size}
            </div></div>
          )}
          {activeTab==="attendees"&&(
            <div>
              <p style={{fontSize:12,color:"var(--dim)",marginBottom:12}}>Representantes de la compañía en el evento:</p>
              {(co.attendees||[]).map((a,i)=>(
                <div key={i} className="attendee-row">
                  <div style={{flex:1}}><div style={{fontSize:13,color:"var(--cream)"}}>{a.name}</div>{a.title&&<div style={{fontSize:11,color:"var(--dim)"}}>{a.title}</div>}</div>
                  <button aria-label="Eliminar representante" className="btn bd bs" onClick={()=>onUpdateCo({...co,attendees:(co.attendees||[]).filter((_,j)=>j!==i)})}>✕</button>
                </div>
              ))}
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <div style={{flex:1}}><div className="lbl">Nombre</div><input className="inp" placeholder="Juan García" value={newName} onChange={e=>setNewName(e.target.value)}/></div>
                <div style={{flex:1}}><div className="lbl">Cargo</div><input className="inp" placeholder="CEO" value={newTitle} onChange={e=>setNewTitle(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&newName.trim()){onUpdateCo({...co,attendees:[...(co.attendees||[]),{name:newName.trim(),title:newTitle.trim()}]});setNewName("");setNewTitle("");}}}/>
                </div>
                <button className="btn bg bs" style={{alignSelf:"flex-end"}} onClick={()=>{if(newName.trim()){onUpdateCo({...co,attendees:[...(co.attendees||[]),{name:newName.trim(),title:newTitle.trim()}]});setNewName("");setNewTitle("");}}}> + </button>
              </div>
            </div>
          )}
          {activeTab==="meetings"&&(
            coMeetings.length===0?<div className="alert ai" aria-live="polite">Sin reuniones asignadas.</div>
            :<table className="tbl"><thead><tr><th>Día</th><th>Hora</th><th>Inversor(es)</th><th>Sala</th></tr></thead>
              <tbody>{coMeetings.map(m=>{const invs=(m.invIds||[]).map(id=>invById.get(id)).filter(Boolean);return(<tr key={m.id}>
                <td><span className={`bdg ${getDayIds(cfg).indexOf(slotDay(m.slotId))%2===0?"bg-b":"bg-grn"}`}>{getDayShort(cfg)[slotDay(m.slotId)]||slotDay(m.slotId)}</span></td>
                <td style={{fontFamily:"IBM Plex Mono,monospace",fontWeight:600,fontSize:11}}>{slotLabel(m.slotId)}</td>
                <td>{invs.map(inv=>(<div key={inv.id} style={{fontSize:12,color:"var(--cream)"}}>{inv.name}<span style={{color:"var(--dim)",fontSize:10}}> — {inv.fund}</span></div>))}</td>
                <td style={{fontFamily:"IBM Plex Mono,monospace",fontSize:11,color:"var(--gold)"}}>{m.room}</td>
              </tr>);})}</tbody></table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn bo bs" onClick={()=>onExport(co,"pdf")}>📄 PDF</button>
          <button className="btn bo bs" onClick={()=>onExport(co,"word")}>📝 Word</button>
          <button className="btn bg bs" style={{marginLeft:8}} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MEETING MODAL
═══════════════════════════════════════════════════════════════════ */
