// ── KanbanBoard.jsx — Pipeline view: Tentative → Confirmed → Completed ──
import { useState } from "react";
import { RS_CLR } from "../roadshow.jsx";

const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
const fmtDay=iso=>{try{return new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"});}catch{return iso;}};

const COLUMNS=[
  {id:"tentative",label:"Tentativas",clr:"#b45309",bg:"#fef3c7",icon:"◌"},
  {id:"confirmed",label:"Confirmadas",clr:"#166534",bg:"#dcfce7",icon:"✓"},
  {id:"completed",label:"Con feedback",clr:"#1e5ab0",bg:"#dbeafe",icon:"★"},
];

export function KanbanBoard({meetings,companies,onClickMeeting,onStatusChange,rsCoById}){
  const [dragItem,setDragItem]=useState(null);

  const getColumn=m=>{
    if(m.feedback?.interestLevel>0||m.postNotes) return "completed";
    return m.status==="confirmed"?"confirmed":"tentative";
  };

  const grouped={tentative:[],confirmed:[],completed:[]};
  (meetings||[]).filter(m=>m.status!=="cancelled").forEach(m=>{
    grouped[getColumn(m)].push(m);
  });
  // Sort each column by date+hour
  Object.values(grouped).forEach(arr=>arr.sort((a,b)=>a.date.localeCompare(b.date)||a.hour-b.hour));

  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,minHeight:300}}>
      {COLUMNS.map(col=>(
        <div key={col.id}
          onDragOver={e=>{e.preventDefault();e.currentTarget.style.background=`${col.bg}`;}}
          onDragLeave={e=>{e.currentTarget.style.background="";}}
          onDrop={e=>{
            e.currentTarget.style.background="";
            if(!dragItem) return;
            if(col.id==="completed") return; // Can't drag to completed — needs feedback
            if(onStatusChange) onStatusChange(dragItem,col.id);
            setDragItem(null);
          }}
          style={{background:"#fff",border:`1px solid ${col.clr}20`,borderRadius:10,padding:0,overflow:"hidden"}}>
          {/* Column header */}
          <div style={{background:col.bg,padding:"10px 14px",borderBottom:`2px solid ${col.clr}30`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:14}}>{col.icon}</span>
              <span style={{fontSize:11,fontWeight:700,color:col.clr,fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".06em"}}>{col.label}</span>
            </div>
            <span style={{fontSize:12,fontWeight:700,color:col.clr,fontFamily:"IBM Plex Mono,monospace"}}>{grouped[col.id].length}</span>
          </div>
          {/* Cards */}
          <div style={{padding:8,display:"flex",flexDirection:"column",gap:6,minHeight:100}}>
            {grouped[col.id].length===0&&<div style={{textAlign:"center",padding:"20px 10px",color:"#9ca3af",fontSize:11}}>Sin reuniones</div>}
            {grouped[col.id].map(m=>{
              const co=m.type==="company"?rsCoById?.get(m.companyId):null;
              const name=co?.name||(m.lsType||m.title||"Reunión");
              const clr=co?(RS_CLR[co.sector]||"#666"):"#23a29e";
              return(
                <div key={m.id}
                  draggable
                  onDragStart={()=>setDragItem(m.id)}
                  onDragEnd={()=>setDragItem(null)}
                  onClick={()=>onClickMeeting&&onClickMeeting(m)}
                  style={{
                    background:"#fff",border:`1px solid ${clr}25`,borderLeft:`3px solid ${clr}`,
                    borderRadius:6,padding:"8px 10px",cursor:"grab",
                    opacity:dragItem===m.id?.5:1,transition:"all .15s",
                    boxShadow:"0 1px 3px rgba(0,0,0,.04)"
                  }}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 3px 10px ${clr}18`;}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,.04)";}}
                >
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#000039",lineHeight:1.2}}>{name}</div>
                    {co?.ticker&&<span style={{fontSize:8,color:clr,fontFamily:"IBM Plex Mono,monospace",background:`${clr}12`,padding:"1px 4px",borderRadius:3}}>{co.ticker}</span>}
                  </div>
                  <div style={{fontSize:9,color:"#6b7280",fontFamily:"IBM Plex Mono,monospace"}}>{fmtDay(m.date)} · {fmtH(m.hour)}</div>
                  {m.feedback?.interestLevel>0&&<div style={{fontSize:9,color:"#1e5ab0",marginTop:2}}>{"⭐".repeat(m.feedback.interestLevel)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
