// ── BookingPage.jsx — Public booking page (no auth required) ──────
import { useState, useEffect } from "react";
import { supabase } from "../../supabase.js";

const FONT="Calibri,Arial,sans-serif";
const MONO="IBM Plex Mono,monospace";
const BLUE="#1e5ab0";
const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
const fmtDay=iso=>{try{return new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});}catch{return iso;}};

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

  // ── Styles ──
  const page={minHeight:"100vh",background:"#f0f4f8",fontFamily:FONT,color:"#1a1a2e"};
  const container={maxWidth:620,margin:"0 auto",padding:"24px 16px"};
  const card={background:"#fff",borderRadius:12,padding:"20px 24px",marginBottom:16,boxShadow:"0 1px 6px rgba(0,0,57,.06)"};
  const hdr={background:"#000039",borderRadius:12,padding:"24px 28px",marginBottom:20,color:"#fff",textAlign:"center"};
  const slotBtn=(sel)=>({
    padding:"8px 14px",borderRadius:8,border:sel?"2px solid "+BLUE:"1px solid #d1d5db",
    background:sel?"#e8f0fe":"#fff",cursor:"pointer",fontSize:13,fontWeight:sel?700:400,
    fontFamily:MONO,color:sel?BLUE:"#374151",transition:"all .15s"
  });
  const inputStyle={width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #d1d5db",fontSize:13,fontFamily:FONT,boxSizing:"border-box"};
  const labelStyle={fontSize:10,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:".08em",marginBottom:4,display:"block",fontFamily:MONO};
  const btnPrimary={padding:"12px 28px",borderRadius:10,border:"none",background:BLUE,color:"#fff",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:FONT};

  // ── Loading / Error ──
  if(loading) return <div style={page}><div style={container}><div style={hdr}><div style={{fontSize:28,marginBottom:8}}>⏳</div><div>Cargando horarios...</div></div></div></div>;
  if(error) return <div style={page}><div style={container}><div style={hdr}><div style={{fontSize:28,marginBottom:8}}>⚠️</div><div>{error}</div></div></div></div>;
  if(!slots.length&&!done) return <div style={page}><div style={container}><div style={hdr}><div style={{fontSize:28,marginBottom:8}}>📅</div><div style={{fontFamily:"Playfair Display,serif",fontSize:20,marginBottom:8}}>No hay horarios disponibles</div><div style={{fontSize:13,opacity:.7}}>Todos los horarios fueron reservados o aún no se publicaron.</div></div></div></div>;

  // ── Done state ──
  if(done) return(
    <div style={page}><div style={container}>
      <div style={hdr}>
        <div style={{fontSize:40,marginBottom:8}}>✅</div>
        <div style={{fontFamily:"Playfair Display,serif",fontSize:22,marginBottom:6}}>Reserva confirmada</div>
        <div style={{fontSize:13,opacity:.7}}>{eventLabel}</div>
      </div>
      <div style={card}>
        <div style={{textAlign:"center"}}>
          <div style={labelStyle}>Código de confirmación</div>
          <div style={{fontFamily:MONO,fontSize:18,fontWeight:700,color:BLUE,padding:"12px 16px",background:"#f0f4f8",borderRadius:8,marginTop:8,userSelect:"all"}}>{done.confirmCode}</div>
          <p style={{fontSize:12,color:"#6b7280",marginTop:12}}>Guardá este código como referencia. Te esperamos.</p>
        </div>
      </div>
    </div></div>
  );

  // ── Main view ──
  return(
    <div style={page}><div style={container}>
      {/* Header */}
      <div style={hdr}>
        <div style={{fontFamily:"Playfair Display,serif",fontSize:22,marginBottom:4}}>Reservar reunión</div>
        <div style={{fontSize:13,opacity:.7}}>{eventLabel}</div>
      </div>

      {/* Step 1: Pick a slot */}
      <div style={card}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:14,color:"#000039"}}>1. Elegí un horario</div>
        {Object.keys(grouped).sort().map(date=>(
          <div key={date} style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"capitalize",marginBottom:6,fontFamily:MONO}}>{fmtDay(date)}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {grouped[date].map(s=>(
                <button key={s.id} style={slotBtn(selected?.id===s.id)} onClick={()=>setSelected(s)}>
                  {fmtH(s.slot_hour)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Step 2: Form (shown when slot selected) */}
      {selected&&(
        <form onSubmit={handleSubmit} style={card}>
          <div style={{fontSize:15,fontWeight:700,marginBottom:4,color:"#000039"}}>2. Completá tus datos</div>
          <div style={{fontSize:11,color:"#6b7280",marginBottom:14}}>
            Horario seleccionado: <strong>{fmtDay(selected.slot_date)} · {fmtH(selected.slot_hour)} hs</strong>
            <button type="button" onClick={()=>setSelected(null)} style={{marginLeft:8,fontSize:10,color:BLUE,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>Cambiar</button>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div><label style={labelStyle}>Empresa *</label><input style={inputStyle} required value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="Nombre de la empresa"/></div>
            <div><label style={labelStyle}>Nombre del representante *</label><input style={inputStyle} required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Juan Pérez"/></div>
            <div><label style={labelStyle}>Email *</label><input type="email" style={inputStyle} required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="juan@empresa.com"/></div>
            <div><label style={labelStyle}>Teléfono</label><input style={inputStyle} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+54 11 1234-5678"/></div>
            <div><label style={labelStyle}>Lugar de preferencia</label>
              <select style={inputStyle} value={form.location} onChange={e=>setForm({...form,location:e.target.value})}>
                <option value="ls_office">Oficinas Latin Securities{officeAddr?" ("+officeAddr+")":""}</option>
                <option value="hq">Nuestra sede / headquarters</option>
                <option value="other">Otro (aclarar en notas)</option>
              </select>
            </div>
            <div><label style={labelStyle}>Notas adicionales</label><textarea style={{...inputStyle,resize:"vertical"}} rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Cantidad de asistentes, requerimientos especiales..."/></div>
          </div>
          <div style={{marginTop:16,textAlign:"center"}}>
            <button type="submit" disabled={submitting} style={{...btnPrimary,opacity:submitting?.6:1}}>
              {submitting?"Reservando...":"✓ Confirmar reserva"}
            </button>
          </div>
        </form>
      )}
    </div></div>
  );
}
