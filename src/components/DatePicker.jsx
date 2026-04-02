// ── DatePicker.jsx — DatePicker and DayDateInput components ──
import { useEffect, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════
   INVESTOR PROFILE MODAL
═══════════════════════════════════════════════════════════════════ */

/* ─── Mini Date Picker ───────────────────────────────────────────── */
export const MONTHS =["January","February","March","April","May","June","July","August","September","October","November","December"];
export const WDAYS =["Su","Mo","Tu","We","Th","Fr","Sa"];
export function DatePicker({value,onChange,onClose}){
  // Handle both YYYY-MM and full YYYY-MM-DD dates
  const parsed=value?new Date((value.length===7?value+"-01":value)+"T12:00:00"):new Date(2026,3,1);
  const [view,setView]=useState({y:parsed.getFullYear(),m:parsed.getMonth()});
  const today=new Date();
  const firstDay=new Date(view.y,view.m,1).getDay();
  const daysInMonth=new Date(view.y,view.m+1,0).getDate();
  const selDate=value?new Date(value+"T12:00:00"):null;
  const cells=[];
  for(let i=0;i<firstDay;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);
  const pad=n=>String(n).padStart(2,"0");
  const isoStr=(d)=>`${view.y}-${pad(view.m+1)}-${pad(d)}`;
  const isSelected=(d)=>selDate&&selDate.getFullYear()===view.y&&selDate.getMonth()===view.m&&selDate.getDate()===d;
  return(
    <div style={{position:"absolute",zIndex:999,background:"#fff",border:"1px solid rgba(30,90,176,.2)",borderRadius:10,boxShadow:"0 8px 32px rgba(30,90,176,.15)",padding:14,minWidth:240,top:"100%",left:0}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#1e5ab0",padding:"2px 6px"}} onClick={()=>setView(v=>v.m===0?{y:v.y-1,m:11}:{...v,m:v.m-1})} aria-label="Mes anterior">‹</button>
        <span style={{fontFamily:"Lora,serif",fontWeight:700,fontSize:13,color:"#000039"}}>{MONTHS[view.m]} {view.y}</span>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#1e5ab0",padding:"2px 6px"}} onClick={()=>setView(v=>v.m===11?{y:v.y+1,m:0}:{...v,m:v.m+1})} aria-label="Mes siguiente">›</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:4}}>
        {WDAYS.map(w=><div key={w} style={{textAlign:"center",fontSize:9,color:"#9aabbf",fontFamily:"IBM Plex Mono,monospace",padding:"2px 0"}}>{w}</div>)}
        {cells.map((d,i)=>d===null
          ?<div key={"e"+i}/>
          :<div key={d} role="button" tabIndex={0} aria-label={`${d} ${MONTHS[view.m]} ${view.y}`} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){onChange(isoStr(d));onClose();}}} onClick={()=>{onChange(isoStr(d));onClose();}}
              style={{textAlign:"center",fontSize:11.5,padding:"5px 2px",borderRadius:5,cursor:"pointer",fontWeight:isSelected(d)?700:400,
                background:isSelected(d)?"#1e5ab0":"transparent",color:isSelected(d)?"#fff":"#2d3f5e",
                border:d===today.getDate()&&view.m===today.getMonth()&&view.y===today.getFullYear()?"1px solid #3399ff":"1px solid transparent"}}
            >{d}</div>
        )}
      </div>
      <button style={{width:"100%",padding:"5px",background:"none",border:"1px solid rgba(30,90,176,.15)",borderRadius:5,cursor:"pointer",fontSize:10,color:"#7a8fa8",fontFamily:"IBM Plex Mono,monospace"}} onClick={onClose}>Cerrar</button>
    </div>
  );
}

/* ─── Day Date Input (date picker + auto-label generator) ────────── */
export function DayDateInput({day,di,onChange}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    if(!open) return;
    const handler=(e)=>{if(ref.current&&!ref.current.contains(e.target)) setOpen(false);};
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[open]);
  function applyDate(isoStr){
    const d=new Date(isoStr+"T12:00:00");
    const shortLabel=d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
    const longLabel=d.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
    // ordinal suffix
    const ord=["th","st","nd","rd"];
    const dayNum=d.getDate();
    const v=dayNum%100;
    const suffix=ord[(v-20)%10]||ord[v]||ord[0];
    const longOrd=d.toLocaleDateString("en-US",{weekday:"long",month:"long",year:"numeric"}).replace(/(\d+)/,dayNum+suffix);
    onChange({...day,date:isoStr,short:shortLabel,long:d.toLocaleDateString("en-US",{weekday:"long"})+" "+d.toLocaleDateString("en-US",{month:"long",day:"numeric"})+"th "+d.getFullYear()});
    setOpen(false);
  }
  const displayLabel=day.date?new Date(day.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):day.short||"Pick a date";
  return(
    <div style={{position:"relative"}} ref={ref}>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#1e5ab0",padding:"0 2px",lineHeight:1}}
          aria-label="Día anterior" onClick={()=>{if(day.date){const d=new Date(day.date+"T12:00:00");d.setDate(d.getDate()-1);applyDate(d.toISOString().slice(0,10));}}}>‹</button>
        <button className="inp" style={{flex:1,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"6px 10px"}}
          onClick={()=>setOpen(o=>!o)}>
          <span style={{fontSize:12,color:"#2d3f5e"}}>{displayLabel}</span>
          <span style={{fontSize:10,color:"#9aabbf"}}>📅</span>
        </button>
        <button style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#1e5ab0",padding:"0 2px",lineHeight:1}}
          aria-label="Día siguiente" onClick={()=>{if(day.date){const d=new Date(day.date+"T12:00:00");d.setDate(d.getDate()+1);applyDate(d.toISOString().slice(0,10));}}}>›</button>
      </div>
      {open&&<DatePicker value={day.date} onChange={applyDate} onClose={()=>setOpen(false)}/>}
    </div>
  );
}


