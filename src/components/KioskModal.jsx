// ── KioskModal.jsx ──
import { useState } from 'react';

export function KioskModal({roadshow,tripDays,rsCoById,kioskDate:kioskDateProp,kioskIdx,setKioskIdx,kioskFb,setKioskFb,kioskFbData,setKioskFbData,onClose,onSaveMtg}){
  const today=new Date().toISOString().slice(0,10);
  const kioskDate=kioskDateProp||(tripDays.includes(today)?today:(tripDays.find(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;})||tripDays[0]||today));
  const kioskMtgs=(roadshow.meetings||[]).filter(m=>m.date===kioskDate&&m.status!=="cancelled").sort((a,b)=>a.hour-b.hour);
  const cur=kioskMtgs[Math.min(kioskIdx,kioskMtgs.length-1)];
  const co=cur?.type==="company"?rsCoById.get(cur.companyId):null;
  const RS_CLR_K={"Financials":"#1e5ab0","Energy":"#e8850a","Utilities":"#23a29e","TMT":"#7c3aed","Infra":"#059669","Industry":"#b45309","Consumer":"#dc2626","Agro":"#65a30d","Exchange":"#0891b2","Real Estate":"#d97706","Other":"#6b7280","LS Internal":"#374151"};
  const clr=cur?(cur.type==="company"?(RS_CLR_K[co?.sector]||"#1e5ab0"):"#23a29e"):"#1e5ab0";
  const allC=co?.contacts||[];
  const selIds=cur?.attendeeIds||[];
  const reps=(selIds.length?allC.filter(r=>selIds.includes(r.id)):allC).filter(r=>r.name);
  const locStr=!cur?"":cur.location==="ls_office"?(roadshow.trip.officeAddress||"Arenales 707, 6° Piso, CABA"):cur.location==="hq"?(co?co.hqAddress||co.name+" HQ":"HQ"):(cur.locationCustom||"TBD");
  const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
  const dayDate=new Date(kioskDate+"T12:00:00");
  const DN=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const isConf=cur?.status==="confirmed";
  const hasFb=!!(cur?.feedback?.interestLevel);
  const fund=roadshow.trip.fund||roadshow.trip.clientName||"Roadshow";
  const n=kioskMtgs.length;
  const idx=Math.min(kioskIdx,n-1);
  // Time remaining until current meeting
  const now=new Date();
  const _mh=cur?Math.floor(cur.hour):0;
  const _mm=cur?Math.round((cur.hour%1)*60):0;
  const mtgStart=cur?new Date(kioskDate+"T"+String(_mh).padStart(2,"0")+":"+String(_mm).padStart(2,"0")+":00"):null;
  const minsUntil=mtgStart?Math.round((mtgStart-now)/60000):null;
  const timeStatus=minsUntil===null?"":minsUntil>120?`en ${Math.floor(minsUntil/60)}h ${minsUntil%60}m`:minsUntil>0?`en ${minsUntil} min`:minsUntil>-90?"En curso":"Finalizada";
  const timeColor=minsUntil===null?"":minsUntil<=0?"#4ade80":minsUntil<=30?"#fbbf24":"rgba(255,255,255,.3)";

  return(
    <div
      style={{position:"fixed",inset:0,background:"#000039",zIndex:8000,display:"flex",flexDirection:"column",fontFamily:"'Lora',Georgia,serif",userSelect:"none"}}
      onTouchStart={e=>{
        // Store touch start position
        e.currentTarget._touchStartX=e.touches[0].clientX;
        e.currentTarget._touchStartY=e.touches[0].clientY;
        e.currentTarget._touchStartT=Date.now();
      }}
      onTouchEnd={e=>{
        const dx=e.changedTouches[0].clientX-(e.currentTarget._touchStartX||0);
        const dy=e.changedTouches[0].clientY-(e.currentTarget._touchStartY||0);
        const dt=Date.now()-(e.currentTarget._touchStartT||0);
        // Swipe: horizontal > 60px, more horizontal than vertical, under 500ms
        if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5&&dt<500){
          if(dx<0){
            // Swipe left → next meeting
            if(idx<n-1){setKioskIdx(idx+1);setKioskFb(false);}
          } else {
            // Swipe right → previous meeting
            if(idx>0){setKioskIdx(idx-1);setKioskFb(false);}
          }
        }
      }}>
      {/* Top bar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,.08)",flexShrink:0}}>
        <div>
          <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:9,color:"rgba(255,255,255,.4)",textTransform:"uppercase",letterSpacing:".15em"}}>
            {DN[dayDate.getDay()]} · {dayDate.toLocaleDateString("es-AR",{day:"numeric",month:"long"})}
          </div>
          <div style={{fontFamily:"Playfair Display,serif",fontSize:13,color:"rgba(255,255,255,.8)",marginTop:2}}>
            {fund} · Agenda del día
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",gap:5}}>
            {kioskMtgs.map((_,i)=>(
              <div key={i} onClick={()=>{setKioskIdx(i);setKioskFb(false);}}
                style={{width:8,height:8,borderRadius:"50%",background:i===idx?"#fff":"rgba(255,255,255,.2)",cursor:"pointer",transition:"background .2s"}}/>
            ))}
          </div>
          <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:10,color:"rgba(255,255,255,.35)"}}>{`${idx+1}/${n}`}</div>
          <button onClick={onClose}
            style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.12)",borderRadius:6,color:"rgba(255,255,255,.45)",padding:"5px 12px",cursor:"pointer",fontSize:11,fontFamily:"IBM Plex Mono,monospace"}}>
            ✕ Salir
          </button>
        </div>
      </div>

      {/* Content */}
      {n===0?(
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,.3)"}}>
          <div style={{fontSize:48,marginBottom:16}}>📅</div>
          <div style={{fontSize:18,fontFamily:"Playfair Display,serif",marginBottom:8}}>Sin reuniones hoy</div>
          <div style={{fontSize:12,fontFamily:"IBM Plex Mono,monospace",opacity:.6}}>{kioskDate}</div>
        </div>
      ):(
        <>
          <div style={{flex:1,overflowY:"auto",padding:"16px 16px 0"}}>
            {/* Company card */}
            <div style={{background:"rgba(255,255,255,.04)",border:"1px solid "+clr+"40",borderRadius:14,padding:"20px",marginBottom:12,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:5,background:clr,borderRadius:"14px 0 0 14px"}}/>
              {/* Time + status */}
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
                <div>
                  <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:44,fontWeight:700,color:"#fff",lineHeight:1,letterSpacing:"-1px"}}>{cur?fmtH(cur.hour):"--:--"}</div>
                  <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:10,color:"rgba(255,255,255,.3)",marginTop:3}}>{roadshow.trip.meetingDuration||60} min</div>
                  {timeStatus&&<div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:9,color:timeColor,marginTop:4,fontWeight:600}}>{timeStatus}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                  <span style={{padding:"4px 12px",borderRadius:5,fontSize:10,fontWeight:700,fontFamily:"IBM Plex Mono,monospace",background:isConf?"rgba(22,101,52,.6)":"rgba(133,77,14,.4)",color:isConf?"#86efac":"#fde68a"}}>
                    {isConf?"✓ CONF.":"◌ TENT."}
                  </span>
                  {hasFb&&<span style={{fontSize:20}}>{["","💤","😐","👍","😃","🔥"][cur.feedback.interestLevel]}</span>}
                </div>
              </div>
              {/* Company */}
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
                {co&&<div style={{width:46,height:46,borderRadius:9,background:clr,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",fontFamily:"IBM Plex Mono,monospace",flexShrink:0}}>{co.ticker?.slice(0,4)}</div>}
                <div>
                  <div style={{fontFamily:"Playfair Display,serif",fontSize:20,fontWeight:700,color:"#fff",lineHeight:1.2}}>{co?co.name:(cur?.lsType||cur?.title||"Reunión interna")}</div>
                  {co&&<div style={{fontSize:10,color:clr,fontFamily:"IBM Plex Mono,monospace",marginTop:3}}>{co.sector}</div>}
                </div>
              </div>
              {/* Reps */}
              {reps.length>0&&(
                <div style={{marginBottom:12}}>
                  {reps.map((r,ri)=>(
                    <div key={ri} style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:clr,flexShrink:0}}/>
                      <span style={{fontSize:12,color:"rgba(255,255,255,.8)"}}>{r.name}</span>
                      {r.title&&<span style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>{r.title}</span>}
                    </div>
                  ))}
                </div>
              )}
              {/* Location */}
              {locStr&&<div style={{display:"flex",gap:7,marginBottom:10,padding:"8px 10px",background:"rgba(255,255,255,.04)",borderRadius:7}}>
                <span style={{flexShrink:0}}>📍</span>
                <span style={{fontSize:11,color:"rgba(255,255,255,.55)",lineHeight:1.5}}>{locStr}</span>
              </div>}
              {/* Notes */}
              {cur?.notes&&<div style={{padding:"8px 10px",background:"rgba(255,255,255,.03)",borderRadius:7,borderLeft:"3px solid "+clr+"60",marginBottom:6}}>
                <div style={{fontSize:8,fontFamily:"IBM Plex Mono,monospace",color:"rgba(255,255,255,.22)",textTransform:"uppercase",marginBottom:3}}>Notas</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.5)",lineHeight:1.6}}>{cur.notes}</div>
              </div>}
              {cur?.postNotes&&<div style={{padding:"8px 10px",background:"rgba(22,101,52,.15)",borderRadius:7,borderLeft:"3px solid #4ade80"}}>
                <div style={{fontSize:8,fontFamily:"IBM Plex Mono,monospace",color:"#4ade80",textTransform:"uppercase",marginBottom:3}}>Post-reunión</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.65)",lineHeight:1.6}}>{cur.postNotes}</div>
              </div>}
              {/* Completion summary bar */}
              {(cur?.postNotes||hasFb)&&(
                <div style={{marginTop:10,padding:"6px 10px",background:"rgba(22,101,52,.08)",borderRadius:6,display:"flex",gap:10,alignItems:"center"}}>
                  {hasFb&&<span style={{fontSize:11}}>{["","💤","😐","👍","😃","🔥"][cur.feedback.interestLevel]} {["","Sin interés","Bajo","Medio","Interesado","Muy interesado"][cur.feedback.interestLevel]}</span>}
                  {cur?.feedback?.nextStep&&<span style={{fontSize:9,fontFamily:"IBM Plex Mono,monospace",color:"rgba(255,255,255,.4)",background:"rgba(255,255,255,.06)",padding:"2px 6px",borderRadius:3}}>
                    {{"follow_up_call":"📞 Follow-up","send_materials":"📄 Materiales","meeting_again":"🔁 Repetir","monitor":"👁 Monitor","no_interest":"❌ Sin interés"}[cur.feedback.nextStep]}
                  </span>}
                  {cur?.feedback?.topics?.length>0&&<span style={{fontSize:9,color:"rgba(255,255,255,.3)",fontFamily:"IBM Plex Mono,monospace"}}>{cur.feedback.topics.slice(0,3).join(" · ")}</span>}
                </div>
              )}
            </div>
            {/* Feedback inline */}
            {kioskFb&&cur&&(
              <div style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:14,padding:"16px",marginBottom:12}}>
                <div style={{fontSize:10,fontFamily:"IBM Plex Mono,monospace",color:"rgba(255,255,255,.35)",textTransform:"uppercase",letterSpacing:".1em",marginBottom:12}}>Feedback</div>
                <FeedbackWidget feedback={kioskFbData} onChange={fb=>{
                setKioskFbData(fb);
                if(cur) onSaveMtg({...cur,feedback:fb});
              }}/>
              <div style={{fontSize:10,color:"rgba(255,255,255,.3)",fontFamily:"IBM Plex Mono,monospace",marginTop:8,textAlign:"center"}}>
                ↑ Los cambios se guardan automáticamente
              </div>
              </div>
            )}
          </div>
          {/* Bottom bar */}
          <div style={{padding:"12px 16px 20px",borderTop:"1px solid rgba(255,255,255,.06)",display:"flex",flexDirection:"column",gap:8,flexShrink:0}}>
            <div style={{display:"flex",gap:8}}>
              {!kioskFb?(
                <button onClick={()=>{setKioskFbData(cur?.feedback||{});setKioskFb(true);}}
                  style={{flex:1,padding:"14px",borderRadius:11,border:"none",background:hasFb?"rgba(22,101,52,.5)":"rgba(30,90,176,.55)",color:"#fff",fontSize:14,fontWeight:700,fontFamily:"Playfair Display,serif",cursor:"pointer"}}>
                  {hasFb?""+["","💤","😐","👍","😃","🔥"][cur.feedback.interestLevel]+" Editar feedback":"📊 Completar feedback"}
                </button>
              ):(
                <button onClick={()=>setKioskFb(false)}
                  style={{flex:1,padding:"12px",borderRadius:11,border:"1px solid rgba(255,255,255,.12)",background:"transparent",color:"rgba(255,255,255,.5)",fontSize:13,cursor:"pointer"}}>
                  ✓ Cerrar feedback
                </button>
              )}
              {/* WhatsApp share */}
              {cur&&(()=>{
                const INTEREST_LABELS=["","💤 Sin interés","😐 Bajo","👍 Medio","😃 Interesado","🔥 Muy interesado"];
                const NEXT_LABELS={"follow_up_call":"📞 Follow-up call","send_materials":"📄 Enviar materiales","meeting_again":"🔁 Repetir reunión","monitor":"👁 Monitorear","no_interest":"❌ Sin interés"};
                const coName=co?co.name:(cur.lsType||cur.title||"Reunión interna");
                const fmtDate=kioskDate?new Date(kioskDate+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"}):"";
                const fb=cur.feedback||{};
                const parts=[
                  `📅 *${coName}* — ${fmtDate} ${fmtH(cur.hour)}hs`,
                  isConf?"✅ Confirmada":"◌ Tentativa",
                  reps.length?`👤 ${reps.map(r=>r.name).join(", ")}`:"",
                  fb.interestLevel?`📊 Interés: ${INTEREST_LABELS[fb.interestLevel]}`:"",
                  fb.topics?.length?`🏷 ${fb.topics.join(", ")}`:"",
                  fb.nextStep?`➡️ ${NEXT_LABELS[fb.nextStep]||fb.nextStep}`:"",
                  fb.internalNotes?`📝 ${fb.internalNotes}`:"",
                  cur.postNotes?`✅ Post-reunión: ${cur.postNotes}`:"",
                ].filter(Boolean).join("\n");
                const NL="\n";
                const waUrl="https://wa.me/?text="+encodeURIComponent("*Latin Securities · Feedback interno*"+NL+NL+parts+NL+NL+"_"+fund+"_");
                return(
                  <button onClick={()=>window.open(waUrl,"_blank")}
                    style={{width:50,flexShrink:0,padding:"12px 0",borderRadius:11,border:"1px solid rgba(37,211,102,.25)",background:"rgba(37,211,102,.1)",color:"#25d166",fontSize:20,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
                    title="Compartir por WhatsApp">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </button>
                );
              })()}
            </div>
            {n>1&&<div style={{textAlign:"center",fontFamily:"IBM Plex Mono,monospace",fontSize:8,color:"rgba(255,255,255,.18)",letterSpacing:".1em",marginBottom:2}}>
              ← deslizá para navegar →
            </div>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>{setKioskIdx(Math.max(0,idx-1));setKioskFb(false);}} disabled={idx===0}
                style={{flex:1,padding:"11px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:idx===0?"rgba(255,255,255,.2)":"rgba(255,255,255,.6)",fontSize:13,cursor:idx===0?"default":"pointer"}}>
                ← Anterior
              </button>
              <button onClick={()=>{setKioskIdx(Math.min(n-1,idx+1));setKioskFb(false);}} disabled={idx===n-1}
                style={{flex:1,padding:"11px",borderRadius:10,border:"1px solid "+(idx===n-1?"rgba(255,255,255,.1)":clr+"60"),background:idx===n-1?"transparent":clr+"22",color:idx===n-1?"rgba(255,255,255,.2)":"#fff",fontSize:13,fontWeight:idx===n-1?400:600,cursor:idx===n-1?"default":"pointer"}}>
                Siguiente →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

