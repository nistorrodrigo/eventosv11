// ── MeetingModal.jsx ──
import { useState } from 'react';

export function MeetingModal({mode,meeting,investors,meetings,companies,allSlots,rooms,config:modalConfig,onSave,onDelete,onClose}){
  const cfg = modalConfig||DEFAULT_CONFIG;
  const invById=new Map((investors||[]).map(i=>[i.id,i]));
  const coById=new Map((companies||[]).map(c=>[c.id,c]));
  const [invIds,setInvIds]=useState(meeting?.invIds||[]);
  const [coId,setCoId]=useState(meeting?.coId||"");
  const [slotId,setSlotId]=useState(meeting?.slotId||"");
  const [room,setRoom]=useState(meeting?.room||rooms[0]);
  const hours=[...new Set(allSlots.map(s=>slotHour(s)))];
  // Build lookup Sets once for O(1) conflict detection (js-set-map-lookups)
  const conflicts=useMemo(()=>{
    const c=[];if(!invIds.length||!coId||!slotId) return c;
    const others=meetings.filter(m=>m.id!==meeting?.id&&m.slotId===slotId);
    const busyInvs=new Set(others.flatMap(m=>m.invIds||[]));
    const busyCos=new Set(others.map(m=>m.coId));
    const busyRooms=new Set(others.map(m=>m.room).filter(Boolean));
    for(const invId of invIds){if(busyInvs.has(invId)) c.push(`${invById.get(invId)?.name} ya tiene reunión`);}
    if(busyCos.has(coId)) c.push(`${coById.get(coId)?.name} ya tiene reunión`);
    if(room&&busyRooms.has(room)) c.push(`${room} ocupada`);
    return c;
  },[invIds,coId,slotId,room,meetings,meeting,invById,coById]);
  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:500}}>
        <div className="modal-hdr"><div className="modal-title">{mode==="add"?"Nueva Reunión":"Editar Reunión"}</div></div>
        <div className="modal-body">
          <div style={{marginBottom:13}}><div className="lbl">Inversor(es)</div>
            <div style={{maxHeight:150,overflowY:"auto",background:"var(--ink3)",borderRadius:6,border:"1px solid rgba(30,90,176,.12)",padding:6}}>
              {investors.map(inv=>(<label key={inv.id} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 6px",cursor:"pointer",borderRadius:4,background:invIds.includes(inv.id)?"rgba(30,90,176,.1)":"transparent"}}>
                <input type="checkbox" checked={invIds.includes(inv.id)} onChange={()=>setInvIds(p=>p.includes(inv.id)?p.filter(x=>x!==inv.id):[...p,inv.id])} style={{accentColor:"var(--gold)"}}/>
                <span style={{fontSize:12,color:"var(--txt)"}}>{inv.name}</span>
                <span style={{fontSize:10,color:"var(--dim)",marginLeft:"auto"}}>{inv.fund}</span>
              </label>))}
            </div>
          </div>
          <div className="g2" style={{gap:12,marginBottom:12}}>
            <div><div className="lbl">Compañía</div>
              <select className="sel" value={coId} onChange={e=>setCoId(e.target.value)}>
                <option value="">-- seleccionar --</option>
                {companies.map(c=><option key={c.id} value={c.id}>{c.name} ({c.ticker})</option>)}
              </select>
            </div>
            <div><div className="lbl">Sala</div>
              <select className="sel" value={room} onChange={e=>setRoom(e.target.value)}>
                {rooms.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div><div className="lbl">Día y Hora</div>
            <select className="sel" value={slotId} onChange={e=>setSlotId(e.target.value)}>
              <option value="">-- seleccionar --</option>
              {getDayIds(cfg).map(d=><optgroup key={d} label={getDayShort(cfg)[d]||d}>{hours.map(h=><option key={`${d}-${h}`} value={`${d}-${h}`}>{getDayShort(cfg)[d]||d} {hourLabel(h)}</option>)}</optgroup>)}
            </select>
          </div>
          {conflicts.length>0&&<div className="alert aw" aria-live="polite" style={{marginTop:10}}>⚠ Conflicto: {conflicts.join(" · ")}<br/><span style={{fontSize:10,color:"var(--dim)"}}>Cambiá el horario o la sala para resolver el conflicto.</span></div>}
        </div>
        <div className="modal-footer">
          {mode==="edit"&&<button className="btn bd bs" onClick={onDelete}>🗑 Eliminar</button>}
          <button className="btn bo bs" onClick={onClose}>Cancelar</button>
          <button className="btn bg bs" disabled={!invIds.length||!coId||!slotId||conflicts.length>0} onClick={()=>onSave({invIds,coId,slotId,room})} style={{opacity:(!invIds.length||!coId||!slotId||conflicts.length>0)?.5:1}}>
            {mode==="add"?"Agregar":"Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════ */
