// ── BookingPage.jsx — Public booking page (no auth required) ──────
import { useState, useEffect } from "react";
import { supabase } from "../../supabase.js";

const BLUE="#1e5ab0";
const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
const fmtDay=iso=>{try{return new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});}catch{return iso;}};
const BOOK_CSS=`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
.bp{min-height:100vh;background:#f0f4f8;font-family:Calibri,Arial,sans-serif;color:#1a1a2e}
.bp-wrap{max-width:620px;margin:0 auto;padding:24px 16px}
.bp-card{background:#fff;border-radius:12px;padding:20px 24px;margin-bottom:16px;box-shadow:0 1px 6px rgba(0,0,57,.06)}
.bp-hdr{background:#000039;border-radius:12px;padding:24px 20px;margin-bottom:20px;color:#fff;text-align:center}
.bp-slot{padding:10px 16px;border-radius:8px;border:1px solid #d1d5db;background:#fff;cursor:pointer;font-size:14px;font-family:'IBM Plex Mono',monospace;color:#374151;transition:all .15s;min-width:54px;text-align:center}
.bp-slot:hover{border-color:#1e5ab0;background:#f0f4ff}
.bp-slot.on{border:2px solid #1e5ab0;background:#e8f0fe;color:#1e5ab0;font-weight:700}
.bp-inp{width:100%;padding:12px 14px;border-radius:8px;border:1px solid #d1d5db;font-size:16px;font-family:Calibri,Arial,sans-serif;box-sizing:border-box}
.bp-inp:focus{outline:none;border-color:#1e5ab0}
.bp-lbl{font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;display:block;font-family:'IBM Plex Mono',monospace}
.bp-btn{padding:14px 28px;border-radius:10px;border:none;background:#1e5ab0;color:#fff;font-size:16px;font-weight:700;cursor:pointer;width:100%;font-family:Calibri,Arial,sans-serif}
.bp-btn:hover{background:#1a4f9d}.bp-btn:disabled{opacity:.6;cursor:not-allowed}
@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
.bp-skel{background:linear-gradient(90deg,#f0f3f8 25%,#e4e9f2 37%,#f0f3f8 63%);background-size:800px 100%;animation:shimmer 1.4s ease-in-out infinite;border-radius:8px}
`;

export default function BookingPage({eventId}){
  const [slots,setSlots]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [selected,setSelected]=useState(null); // {id,slot_date,slot_hour}
  const [form,setForm]=useState({company:"",name:"",email:"",phone:"",location:"ls_office",notes:""});
  const [submitting,setSubmitting]=useState(false);
  const [done,setDone]=useState(null); // {confirmCode}
  const [eventLabel,setEventLabel]=useState("");
  const [officeAddr,setOfficeAddr]=useState("");

  // Fetch slots
  async function loadSlots(){
    setLoading(true);
    const {data,error:err}=await supabase.from("roadshow_slots").select("*").eq("event_id",eventId).order("slot_date").order("slot_hour");
    if(err){setError("No se pudieron cargar los horarios.");setLoading(false);return;}
    setSlots(data||[]);
    if(data?.length){setEventLabel(data[0].event_label||"");setOfficeAddr(data[0].office_address||"");}
    setLoading(false);
  }
  useEffect(()=>{loadSlots();const iv=setInterval(loadSlots,60000);return()=>clearInterval(iv);},[eventId]);

  // Group slots by date
  const grouped={};
  slots.forEach(s=>{if(!grouped[s.slot_date])grouped[s.slot_date]=[];grouped[s.slot_date].push(s);});

  // Submit booking
  async function handleSubmit(e){
    e.preventDefault();
    if(!selected||!form.company.trim()||!form.name.trim()||!form.email.trim())return;
    setSubmitting(true);
    const confirmCode="RS-"+Date.now().toString(36).toUpperCase()+"-"+Math.random().toString(36).slice(2,6).toUpperCase();
    const ownerId=selected.owner_id;
    // Insert booking
    const {error:insErr}=await supabase.from("roadshow_bookings").insert({
      event_id:eventId, slot_date:selected.slot_date, slot_hour:selected.slot_hour,
      company:form.company.trim(), contact_name:form.name.trim(), email:form.email.trim(),
      phone:form.phone.trim()||null, location_pref:form.location, notes:form.notes.trim()||null,
      confirm_code:confirmCode, owner_id:ownerId
    });
    if(insErr){setSubmitting(false);setError("Error al reservar. Intentá de nuevo.");return;}
    // Delete the slot to prevent double booking
    await supabase.from("roadshow_slots").delete().eq("id",selected.id);
    setDone({confirmCode});
    setSubmitting(false);
  }

  // Styles now in BOOK_CSS classes (bp-*)

  // ── Loading / Error ──
  if(loading) return <div className="bp"><style>{BOOK_CSS}</style><div className="bp-wrap"><div className="bp-hdr"><div style={{fontSize:28,marginBottom:8}}>⏳</div><div>Cargando horarios...</div></div><div className="bp-card">{[1,2,3].map(i=><div key={i} style={{display:"flex",gap:8,marginBottom:12}}>{[1,2,3,4].map(j=><div key={j} className="bp-skel" style={{width:54,height:38}}/>)}</div>)}</div></div></div>;
  if(error) return <div className="bp"><style>{BOOK_CSS}</style><div className="bp-wrap"><div className="bp-hdr"><div style={{fontSize:28,marginBottom:8}}>⚠️</div><div>{error}</div></div></div></div>;
  if(!slots.length&&!done) return <div className="bp"><style>{BOOK_CSS}</style><div className="bp-wrap"><div className="bp-hdr"><div style={{fontSize:28,marginBottom:8}}>📅</div><div style={{fontFamily:"Playfair Display,serif",fontSize:20,marginBottom:8}}>No hay horarios disponibles</div><div style={{fontSize:13,opacity:.7}}>Todos los horarios fueron reservados o aún no se publicaron.</div></div></div></div>;

  // ── Done state ──
  if(done) return(
    <div className="bp"><style>{BOOK_CSS}</style><div className="bp-wrap">
      <div className="bp-hdr">
        <div style={{fontSize:40,marginBottom:8}}>✅</div>
        <div style={{fontFamily:"Playfair Display,serif",fontSize:22,marginBottom:6}}>Reserva confirmada</div>
        <div style={{fontSize:13,opacity:.7}}>{eventLabel}</div>
      </div>
      <div className="bp-card" style={{textAlign:"center"}}>
        <div className="bp-lbl">Código de confirmación</div>
        <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:18,fontWeight:700,color:BLUE,padding:"12px 16px",background:"#f0f4f8",borderRadius:8,marginTop:8,userSelect:"all"}}>{done.confirmCode}</div>
        <p style={{fontSize:12,color:"#6b7280",marginTop:12}}>Guardá este código como referencia. Te esperamos.</p>
      </div>
    </div></div>
  );

  // ── Main view ──
  return(
    <div className="bp"><style>{BOOK_CSS}</style><div className="bp-wrap">
      {/* Header */}
      <div className="bp-hdr">
        <div style={{fontFamily:"Playfair Display,serif",fontSize:22,marginBottom:4}}>Reservar reunión</div>
        <div style={{fontSize:13,opacity:.7}}>{eventLabel}</div>
      </div>

      {/* Step 1: Pick a slot */}
      <div className="bp-card">
        <div style={{fontSize:15,fontWeight:700,marginBottom:14,color:"#000039"}}>1. Elegí un horario</div>
        {Object.keys(grouped).sort().map(date=>(
          <div key={date} style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"capitalize",marginBottom:6,fontFamily:"IBM Plex Mono,monospace"}}>{fmtDay(date)}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {grouped[date].map(s=>(
                <button key={s.id} className={`bp-slot${selected?.id===s.id?" on":""}`} onClick={()=>setSelected(s)}>
                  {fmtH(s.slot_hour)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Step 2: Form (shown when slot selected) */}
      {selected&&(
        <form onSubmit={handleSubmit} className="bp-card">
          <div style={{fontSize:15,fontWeight:700,marginBottom:4,color:"#000039"}}>2. Completá tus datos</div>
          <div style={{fontSize:11,color:"#6b7280",marginBottom:14}}>
            Horario seleccionado: <strong>{fmtDay(selected.slot_date)} · {fmtH(selected.slot_hour)} hs</strong>
            <button type="button" onClick={()=>setSelected(null)} style={{marginLeft:8,fontSize:10,color:BLUE,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>Cambiar</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><label className="bp-lbl">Empresa *</label><input className="bp-inp" required value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="Nombre de la empresa"/></div>
            <div><label className="bp-lbl">Nombre del representante *</label><input className="bp-inp" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Juan Pérez"/></div>
            <div><label className="bp-lbl">Email *</label><input type="email" className="bp-inp" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="juan@empresa.com"/></div>
            <div><label className="bp-lbl">Teléfono</label><input className="bp-inp" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+54 11 1234-5678"/></div>
            <div><label className="bp-lbl">Lugar de preferencia</label>
              <select className="bp-inp" value={form.location} onChange={e=>setForm({...form,location:e.target.value})}>
                <option value="ls_office">Oficinas Latin Securities{officeAddr?" ("+officeAddr+")":""}</option>
                <option value="hq">Nuestra sede / headquarters</option>
                <option value="other">Otro (aclarar en notas)</option>
              </select>
            </div>
            <div><label className="bp-lbl">Notas adicionales</label><textarea className="bp-inp" style={{resize:"vertical"}} rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Cantidad de asistentes, requerimientos especiales..."/></div>
          </div>
          <div style={{marginTop:16,textAlign:"center"}}>
            <button type="submit" disabled={submitting} className="bp-btn">
              {submitting?"Reservando...":"✓ Confirmar reserva"}
            </button>
          </div>
        </form>
      )}
    </div></div>
  );
}
