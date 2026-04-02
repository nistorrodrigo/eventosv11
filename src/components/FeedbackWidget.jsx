// ── FeedbackWidget.jsx ──
import { useState } from 'react';

// ── Meeting Feedback Widget ─────────────────────────────────────────
export const INTEREST_LEVELS =[
  {val:1,lbl:"Sin interés",    clr:"#dc2626",bg:"#fee2e2",emoji:"💤"},
  {val:2,lbl:"Bajo interés",   clr:"#ea580c",bg:"#ffedd5",emoji:"😐"},
  {val:3,lbl:"Interés medio",  clr:"#ca8a04",bg:"#fef9c3",emoji:"👍"},
  {val:4,lbl:"Interesado",     clr:"#16a34a",bg:"#dcfce7",emoji:"😃"},
  {val:5,lbl:"Muy interesado", clr:"#166534",bg:"#bbf7d0",emoji:"🔥"},
];
export const FEEDBACK_TOPICS =["Valuación","Macro","Mgmt","Sector","Deuda","ESG","Gobernanza","Deal flow","M&A","Dividendos","FX","Tasas","Resultados","Guidance"];
export const NEXT_STEPS =[
  {val:"follow_up_call",  lbl:"📞 Follow-up call"},
  {val:"send_materials",  lbl:"📄 Enviar materiales"},
  {val:"meeting_again",   lbl:"🔁 Repetir reunión"},
  {val:"monitor",         lbl:"👁 Monitorear"},
  {val:"no_interest",     lbl:"❌ Sin interés"},
];
export function FeedbackWidget({feedback={},onChange,compact=false}){
  const fb={interestLevel:0,topics:[],nextStep:"",internalNotes:"",...feedback};
  const set=(k,v)=>onChange({...fb,[k]:v});
  const toggleTopic=t=>set("topics",fb.topics.includes(t)?fb.topics.filter(x=>x!==t):[...fb.topics,t]);
  const curLevel=INTEREST_LEVELS.find(l=>l.val===fb.interestLevel);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:compact?8:12}}>
      {/* Interest level */}
      <div>
        <div style={{fontSize:9,fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".1em",color:"var(--dim)",marginBottom:6}}>Nivel de interés</div>
        <div style={{display:"flex",gap:4}}>
          {INTEREST_LEVELS.map(l=>(
            <button key={l.val}
              onClick={()=>set("interestLevel",fb.interestLevel===l.val?0:l.val)}
              title={l.lbl}
              style={{flex:1,padding:compact?"6px 4px":"8px 4px",border:`2px solid ${fb.interestLevel===l.val?l.clr:"rgba(30,90,176,.1)"}`,borderRadius:7,background:fb.interestLevel===l.val?l.bg:"transparent",cursor:"pointer",transition:"all .12s",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
              <span style={{fontSize:compact?16:20}}>{l.emoji}</span>
              {!compact&&<span style={{fontSize:7.5,fontFamily:"IBM Plex Mono,monospace",color:fb.interestLevel===l.val?l.clr:"var(--dim)",fontWeight:fb.interestLevel===l.val?700:400,lineHeight:1.2,textAlign:"center"}}>{l.lbl}</span>}
            </button>
          ))}
        </div>
        {curLevel&&<div style={{fontSize:10,color:curLevel.clr,fontFamily:"IBM Plex Mono,monospace",marginTop:4,fontWeight:600}}>{curLevel.emoji} {curLevel.lbl}</div>}
      </div>
      {/* Topics */}
      <div>
        <div style={{fontSize:9,fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".1em",color:"var(--dim)",marginBottom:6}}>Temas discutidos</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {FEEDBACK_TOPICS.map(t=>{
            const active=fb.topics.includes(t);
            return(
              <button key={t} onClick={()=>toggleTopic(t)}
                style={{padding:"3px 9px",borderRadius:20,border:`1px solid ${active?"#1e5ab0":"rgba(30,90,176,.15)"}`,background:active?"rgba(30,90,176,.1)":"transparent",color:active?"#1e5ab0":"var(--dim)",fontSize:10,cursor:"pointer",transition:"all .1s",fontWeight:active?600:400}}>
                {t}
              </button>
            );
          })}
        </div>
      </div>
      {/* Next step */}
      <div>
        <div style={{fontSize:9,fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".1em",color:"var(--dim)",marginBottom:6}}>Próximo paso</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {NEXT_STEPS.map(s=>{
            const active=fb.nextStep===s.val;
            return(
              <button key={s.val} onClick={()=>set("nextStep",active?"":s.val)}
                style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${active?"#1e5ab0":"rgba(30,90,176,.15)"}`,background:active?"#1e5ab0":"transparent",color:active?"#fff":"var(--dim)",fontSize:10,cursor:"pointer",transition:"all .1s"}}>
                {s.lbl}
              </button>
            );
          })}
        </div>
      </div>
      {/* Internal notes */}
      <div>
        <div style={{fontSize:9,fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".1em",color:"var(--dim)",marginBottom:4}}>Notas internas</div>
        <textarea className="inp" style={{minHeight:compact?44:60,resize:"vertical",fontSize:11}}
          value={fb.internalNotes} onChange={e=>set("internalNotes",e.target.value)}
          placeholder="Impresiones del equipo, contexto del fondo, acciones concretas..."/>
      </div>
    </div>
  );
}

// ── KioskModal — Day-of full-screen view ────────────────────────────────
