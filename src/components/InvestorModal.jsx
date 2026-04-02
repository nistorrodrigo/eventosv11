// ── InvestorModal.jsx ──
import { useState } from 'react';

export function InvestorModal({inv,investors,meetings,companies,fundGrouping,allSlots,config:invCfg,onUpdateInv,onToggleFundGroup,onExport,onClose}){
  const cfg=invCfg||DEFAULT_CONFIG;
  const [activeTab,setActiveTab]=useState("profile");
  const [editField,setEditField]=useState({});
  const invMeetings=meetings.filter(m=>(m.invIds||[]).includes(inv.id)).sort((a,b)=>allSlots.indexOf(a.slotId)-allSlots.indexOf(b.slotId));
  const fundmates=investors.filter(i=>i.id!==inv.id&&i.fund===inv.fund&&inv.fund);
  const isGrouped=inv.fund?(fundGrouping[inv.fund]!==false):false;
  const activeHours=[...new Set(allSlots.map(s=>slotHour(s)))];

  function toggleSlot(slotId){
    const base=inv.slots||[];
    if(!base.includes(slotId)) onUpdateInv({...inv,slots:[...base,slotId].sort((a,b)=>allSlots.indexOf(a)-allSlots.indexOf(b))});
    else{const bl=inv.blockedSlots||[];if(bl.includes(slotId)) onUpdateInv({...inv,blockedSlots:bl.filter(s=>s!==slotId)});else onUpdateInv({...inv,blockedSlots:[...bl,slotId]});}
  }
  function toggleCo(coId){const cos=inv.companies||[];if(cos.includes(coId)) onUpdateInv({...inv,companies:cos.filter(c=>c!==coId)});else onUpdateInv({...inv,companies:[...cos,coId]});}
  const eff=effectiveSlots(inv,allSlots);

  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:680}}>
        <div className="modal-hdr">
          <div className="modal-title">{inv.name}</div>
          <div className="modal-sub">{[inv.position,inv.fund].filter(Boolean).join(" · ")}</div>
          <div className="modal-tabs" style={{marginTop:14}}>
            {[["profile","👤 Perfil"],["restrictions","🕐 Horarios"],["companies","🏢 Compañías"],["meetings","📅 Reuniones"]].map(([t,l])=>(
              <button key={t} className={`mtab${activeTab===t?" on":""}`} onClick={()=>setActiveTab(t)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="modal-body">
          {activeTab==="profile"&&(
            <div>
              <div className="g2" style={{gap:12,marginBottom:14}}>
                {[["name","Nombre completo","text"],["fund","Fondo / Firma","text"],["position","Cargo","text"],["email","Email","email"],["phone","Teléfono","text"],["aum","AUM","text"]].map(([f,label,type])=>(
                  <div key={f}><div className="lbl">{label}</div>
                    <input className="inp" type={type} value={editField[f]!==undefined?editField[f]:(inv[f]||"")}
                      onChange={e=>setEditField(p=>({...p,[f]:e.target.value}))}
                      onBlur={()=>{if(editField[f]!==undefined){const u={...inv,...editField};if(f==="name")u.name=capitalizeName(u.name);onUpdateInv(u);setEditField({});}}}/>
                  </div>
                ))}
              </div>
              {fundmates.length>0&&(
                <div className="fund-group">
                  <div style={{flex:1}}>
                    <div style={{fontSize:12.5,color:"var(--cream)"}}>Agrupar con colegas del mismo fondo</div>
                    <div style={{fontSize:11,color:"var(--dim)",marginTop:2}}>{fundmates.map(f=>f.name).join(", ")}</div>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={isGrouped} onChange={()=>onToggleFundGroup(inv.fund,!isGrouped)}/>
                    <div className="toggle-track"/><div className="toggle-thumb"/>
                  </label>
                </div>
              )}
            </div>
          )}
          {activeTab==="restrictions"&&(
            <div>
              <p style={{fontSize:12,color:"var(--dim)",marginBottom:12,lineHeight:1.7}}>Verde = disponible · Rojo = bloqueado · Clic para togglear. Gris = fuera de disponibilidad declarada.</p>
              <div style={{fontSize:11,color:"var(--txt)",marginBottom:10}}><span className="bdg bg-grn">{eff.length}</span> slots efectivos de {allSlots.length}</div>
              {getDayIds(cfg).map(d=>(
                <div key={d} style={{marginBottom:14}}>
                  <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:10,color:getDayIds(cfg).indexOf(d)%2===0?"var(--blu)":"var(--grn)",marginBottom:6,letterSpacing:".06em",textTransform:"uppercase"}}>◆ {getDayShort(cfg)[d]||d}</div>
                  <div style={{display:"grid",gridTemplateColumns:`repeat(${activeHours.length},1fr)`,gap:3}}>
                    {activeHours.map(h=>{const sid=`${d}-${h}`;const inBase=(inv.slots||[]).includes(sid);const isBlocked=(inv.blockedSlots||[]).includes(sid);
                      return <div key={h} className={`slot-cell ${!inBase?"slot-na":isBlocked?"slot-blocked":"slot-avail"}`} onClick={()=>inBase&&toggleSlot(sid)}>{hourLabel(h)}</div>;})}
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab==="companies"&&(
            <div>
              <p style={{fontSize:12,color:"var(--dim)",marginBottom:12}}>Compañías que este inversor quiere reunirse:</p>
              {["Financials","Energy","Infra","Real Estate","TMT","LS"].map(sector=>{
                const scos=COMPANIES_INIT.filter(c=>c.sector===sector); if(!scos.length) return null;
                return(<div key={sector}><div className="sec-hdr">{sector}</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}>
                    {scos.map(c=>{const on=(inv.companies||[]).includes(c.id);return(
                      <div key={c.id} onClick={()=>toggleCo(c.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:6,cursor:"pointer",background:on?"rgba(30,90,176,.1)":"rgba(255,255,255,.03)",border:`1px solid ${on?"rgba(30,90,176,.22)":"rgba(255,255,255,.06)"}`,transition:"all .12s"}}>
                        <div style={{width:14,height:14,borderRadius:3,background:on?"var(--gold)":"rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:10,color:"var(--ink)",fontWeight:700}}>{on?"✓":""}</div>
                        <span style={{fontSize:12,color:on?"var(--cream)":"var(--dim)"}}>{c.name}</span>
                        <span className="bdg bg-g" style={{marginLeft:"auto",fontSize:9}}>{c.ticker}</span>
                      </div>);})}
                  </div></div>);
              })}
            </div>
          )}
          {activeTab==="meetings"&&(
            invMeetings.length===0?<div className="alert ai" aria-live="polite">Sin reuniones asignadas.</div>
            :<table className="tbl"><thead><tr><th>Día</th><th>Hora</th><th>Compañía</th><th>Sala</th></tr></thead>
              <tbody>{invMeetings.map(m=>{const co=coById.get(m.coId);return(<tr key={m.id}>
                <td><span className={`bdg ${getDayIds(cfg).indexOf(slotDay(m.slotId))%2===0?"bg-b":"bg-grn"}`}>{getDayShort(cfg)[slotDay(m.slotId)]||slotDay(m.slotId)}</span></td>
                <td style={{fontFamily:"IBM Plex Mono,monospace",fontWeight:600,fontSize:11}}>{slotLabel(m.slotId)}</td>
                <td style={{color:"var(--cream)",fontWeight:600}}>{co?.name}<span className="bdg bg-g" style={{marginLeft:6}}>{co?.ticker}</span></td>
                <td style={{fontFamily:"IBM Plex Mono,monospace",fontSize:11,color:"var(--gold)"}}>{m.room}</td>
              </tr>);})}</tbody></table>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn bo bs" onClick={()=>onExport(inv,"pdf")}>📄 PDF</button>
          <button className="btn bo bs" onClick={()=>onExport(inv,"word")}>📝 Word</button>
          <button className="btn bg bs" style={{marginLeft:8}} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   COMPANY PROFILE MODAL
═══════════════════════════════════════════════════════════════════ */
