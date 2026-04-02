// ── RoadshowEmailModal.jsx ──
import { useState } from 'react';

export function RoadshowEmailModal({company,emailData,onClose}){
  const [copied,setCopied]=useState(false);
  function copy(){const t=`Para: ${emailData.to}\nAsunto: ${emailData.subject}\n\n${emailData.body}`;navigator.clipboard.writeText(t).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);}).catch(()=>{const w=window.open("","_blank","width=680,height=520");w.document.write("<pre style='font:13px monospace;padding:20px;white-space:pre-wrap'>"+t.replace(/</g,"&lt;")+"</pre>");w.document.close();});}
  function openMail(){window.location.href=`mailto:${encodeURIComponent(emailData.to)}?subject=${encodeURIComponent(emailData.subject)}&body=${encodeURIComponent(emailData.body)}`;}
  return(
    <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal" style={{maxWidth:610}}>
        <div className="modal-hdr"><div className="modal-title">✉️ {company.name}</div></div>
        <div className="modal-body">
          <div style={{marginBottom:8}}><div className="lbl">Para</div>
            <div style={{fontSize:12,color:emailData.to?"var(--txt)":"var(--red)",background:"var(--ink3)",padding:"5px 10px",borderRadius:5,fontFamily:"IBM Plex Mono,monospace"}}>
              {emailData.to||"⚠ Completar email en la sección Empresas"}</div></div>
          <div style={{marginBottom:10}}><div className="lbl">Asunto</div>
            <div style={{fontSize:12,color:"var(--cream)",background:"var(--ink3)",padding:"5px 10px",borderRadius:5,fontWeight:600}}>{emailData.subject}</div></div>
          <div><div className="lbl">Cuerpo del email (español)</div>
            <pre style={{fontFamily:"Lora,Georgia,serif",fontSize:12,color:"var(--txt)",background:"var(--ink3)",padding:"12px 14px",borderRadius:6,whiteSpace:"pre-wrap",maxHeight:340,overflowY:"auto",lineHeight:1.75}}>{emailData.body}</pre></div>
        </div>
        <div className="modal-footer" style={{gap:7}}>
          <button className="btn bo bs" onClick={onClose}>Cerrar</button>
          <button className="btn bo bs" onClick={openMail}>📧 Abrir en Mail</button>
          <button className={`btn bs ${copied?"bo":"bg"}`} onClick={copy}>{copied?"✅ ¡Copiado!":"📋 Copiar todo"}</button>
        </div>
      </div>
    </div>
  );
}

