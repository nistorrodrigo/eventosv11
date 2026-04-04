// ── RoadshowInboundTab.jsx — Inbound Roadshow view ──────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../../supabase.js";
import { toast, toastOk, toastErr, toastWarn } from "../components/Toast.jsx";
import { SkeletonCard } from "../components/Skeleton.jsx";
import { FocusTrap } from "../components/FocusTrap.jsx";
import { useEvent } from "../contexts/EventContext.jsx";
import { WeekCalendar } from "../components/WeekCalendar.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { ROADSHOW_HOURS, fmtHour, RS_CLR, LS_INT_TYPES, genRSEmail, rsToEntity, RoadshowAgendaEmailModal, DailyBriefingEmailModal, parseICS, buildICS, buildBookingPage } from "../roadshow.jsx";
import { getMeetingAddress, cleanAddr, stripNeighborhood, openGoogleMapsRoute, openGoogleMapsDirections, checkTravelConflict, applyBATraffic } from "../travel.js";
import { downloadBlob, buildPrintHTML, esc } from "../storage.jsx";
import { DatePicker, DayDateInput } from "../components/DatePicker.jsx";
import { FeedbackWidget } from "../components/FeedbackWidget.jsx";
import { KioskModal } from "../components/KioskModal.jsx";
import { RoadshowEmailModal } from "../components/RoadshowEmailModal.jsx";
import { RoadshowMeetingModal } from "../components/RoadshowMeetingModal.jsx";
// XLSX lazy-loaded on demand
let _XLSX_TAB=null;
async function getXLSX(){if(!_XLSX_TAB)_XLSX_TAB=await import("xlsx");return _XLSX_TAB;}

export function RoadshowInboundTab({
  events,
  rsSubTab, setRsSubTab, rsDayFilter, setRsDayFilter,
  kioskMode, setKioskMode, kioskIdx, setKioskIdx,
  kioskFb, setKioskFb, kioskFbData, setKioskFbData,
  rsMtgModal, setRsMtgModal, rsEmailModal, setRsEmailModal,
  rsAgendaEmailModal, setRsAgendaEmailModal,
  rsDailyEmailModal, setRsDailyEmailModal,
  icsImportModal, setIcsImportModal, rsMtgsExcelRef, rsExcelRef,
  rsShowParser, setRsShowParser,
  rsCoMapForTravel,
  exportCompanyBrief, exportRoadshowSummary, exportPostRoadshowReport, exportDriverItinerary,
  // lsCont is computed internally from config + roadshow.trip.lsContactIdx
  dragMtg, setDragMtg,
  rsEmailParser, setRsEmailParser,
  travelLoading, setTravelLoading,
  rsBySlot, rsOverlapSet,
  search, setSearch,
  exportBookingPage, exportRoadshowICS, exportRoadshowPDF, exportRoadshowWord,
  handleRsEmailParse, openPrint,
  calcAllTravel, calcDayTravel,
  publishBookingSlots,
}){
        const {roadshow,saveRoadshow,currentEvent,config,tripDays,rsCoById,travelCache,setTravelCache,globalDB,saveGlobalDB}=useEvent();
        const lsCont=(config.contacts||[])[roadshow.trip.lsContactIdx||0]||{};
        // Fuzzy duplicate detection helper
        const normalize=s=>(s||"").toLowerCase().replace(/[^a-záéíóúñ0-9]/g,"").trim();
        const findDuplicates=(name,list,excludeId)=>{
          const n=normalize(name);if(!n||n.length<3)return[];
          return list.filter(c=>c.id!==excludeId&&(normalize(c.name)===n||normalize(c.name).includes(n)||n.includes(normalize(c.name)))).slice(0,3);
        };
        const [editingLeg,setEditingLeg]=useState(null); // { date, idx }
        const [editLegVal,setEditLegVal]=useState("");
        const [agendaView,setAgendaView]=useState("table"); // "table" | "calendar"
        const [waBulkModal,setWaBulkModal]=useState(null);
        const [libPicker,setLibPicker]=useState(false); // library company picker modal
        const [libSelected,setLibSelected]=useState(new Set());
        const [libSearch,setLibSearch]=useState("");
        const [bookings,setBookings]=useState([]);
        // Expense tracker state (must be at top level, not inside IIFE)
        const EXPENSE_CATS=["🚗 Transfer","🍽 Comida","🏨 Hotel","✈️ Vuelo","📱 Comunicaciones","🎫 Entretenimiento","📦 Otros"];
        const EXPENSE_CURRENCIES=["ARS","USD","EUR","BRL","GBP"];
        const [expForm,setExpForm]=useState({date:new Date().toISOString().slice(0,10),category:"🚗 Transfer",description:"",amount:"",currency:"USD",paidBy:"",notes:"",receipt:null,receiptName:null});
        const [expEdit,setExpEdit]=useState(null);
        const [weather,setWeather]=useState(null); // {temp, icon, desc}
        useEffect(()=>{
          if(!rsDayFilter)return;setWeather(null);
          // Buenos Aires: -34.6037, -58.3816
          fetch(`https://api.open-meteo.com/v1/forecast?latitude=-34.60&longitude=-58.38&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=America/Argentina/Buenos_Aires&start_date=${rsDayFilter}&end_date=${rsDayFilter}`)
            .then(r=>r.json()).then(d=>{
              if(!d.daily)return;
              const code=d.daily.weathercode?.[0]||0;
              const tMax=d.daily.temperature_2m_max?.[0];const tMin=d.daily.temperature_2m_min?.[0];
              const WMO={0:"☀️ Despejado",1:"🌤 Mayormente despejado",2:"⛅ Parcialmente nublado",3:"☁️ Nublado",45:"🌫 Niebla",48:"🌫 Niebla",51:"🌧 Llovizna",53:"🌧 Llovizna",55:"🌧 Llovizna",61:"🌧 Lluvia",63:"🌧 Lluvia moderada",65:"🌧 Lluvia fuerte",80:"🌦 Chaparrones",81:"🌦 Chaparrones",82:"⛈ Tormenta",95:"⛈ Tormenta",96:"⛈ Tormenta con granizo"};
              setWeather({temp:`${Math.round(tMin)}°–${Math.round(tMax)}°`,desc:WMO[code]||"—"});
            }).catch(()=>{});
        },[rsDayFilter]);
        const [bookingsLoading,setBookingsLoading]=useState(false);
        const [pendingCount,setPendingCount]=useState(0);
        // Fetch pending count every 30s
        const evId=currentEvent?.id;
        const fetchPendingCount=useCallback(async()=>{
          if(!evId)return;
          const {count}=await supabase.from("roadshow_bookings").select("id",{count:"exact",head:true}).eq("event_id",evId).eq("status","pending");
          setPendingCount(count||0);
        },[evId]);
        useEffect(()=>{fetchPendingCount();const iv=setInterval(fetchPendingCount,30000);return()=>clearInterval(iv);},[fetchPendingCount]);
        // Fetch full bookings when subtab is bookings
        const fetchBookings=useCallback(async()=>{
          if(!evId)return;
          setBookingsLoading(true);
          const {data}=await supabase.from("roadshow_bookings").select("*").eq("event_id",evId).order("created_at",{ascending:false});
          setBookings(data||[]);
          setBookingsLoading(false);
        },[evId]);
        useEffect(()=>{if(rsSubTab==="bookings")fetchBookings();},[rsSubTab,fetchBookings]);
        // Helper to patch a company field inline (used in meeting modal)
        window.__rsCoPatch=(coId,field,val)=>{const nc=(roadshow.companies||[]).map(c=>c.id===coId?{...c,[field]:val}:c);saveRoadshow({...roadshow,companies:nc});};
        function upTrip(f,v){saveRoadshow({...roadshow,trip:{...roadshow.trip,[f]:v}});}
        function saveMtg(m){
          const ex=roadshow.meetings.find(x=>x.id===m.id);
          const ms=ex?roadshow.meetings.map(x=>x.id===m.id?m:x):[...roadshow.meetings,m];
          saveRoadshow({...roadshow,meetings:ms});setRsMtgModal(null);
          // Auto-recalculate travel for affected day(s)
          if(calcDayTravel&&m.date){
            calcDayTravel(m.date);
            if(ex&&ex.date!==m.date) calcDayTravel(ex.date);
          }
        }
        function delMtg(id){saveRoadshow({...roadshow,meetings:roadshow.meetings.filter(m=>m.id!==id)});setRsMtgModal(null);}
        const confirmed=roadshow.meetings.filter(m=>m.status==="confirmed").length;
        const tentative=roadshow.meetings.filter(m=>m.status==="tentative").length;
        return(
        <div>
          <h2 className="pg-h">🗺️ Buenos Aires Roadshow</h2>
          <p className="pg-s">Organizá la agenda para inversores que visitan Argentina — reuniones corporativas, logística y más.</p>

          {/* Trip Setup */}
          <div className="card" style={{marginBottom:14}}>
            <div className="card-t">🧳 Datos del Viaje</div>
            <div className="g3" style={{gap:10,marginBottom:10}}>
              <div><div className="lbl">Cliente / Inversor</div><input className="inp" value={roadshow.trip.clientName} onChange={e=>upTrip("clientName",e.target.value)} placeholder="John Smith"/></div>
              <div><div className="lbl">Fondo / Firma</div><input className="inp" value={roadshow.trip.fund} onChange={e=>upTrip("fund",e.target.value)} placeholder="Merrill Lynch AM"/></div>
              <div><div className="lbl">Hotel</div><input className="inp" value={roadshow.trip.hotel} onChange={e=>upTrip("hotel",e.target.value)} placeholder="Holiday Inn"/></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10,marginBottom:10}}>
              <div><div className="lbl">Llegada</div>
                <DayDateInput day={{date:roadshow.trip.arrivalDate,short:roadshow.trip.arrivalDate,long:""}} di={0} onChange={nd=>upTrip("arrivalDate",nd.date)}/></div>
              <div><div className="lbl">Salida</div>
                <DayDateInput day={{date:roadshow.trip.departureDate,short:roadshow.trip.departureDate,long:""}} di={1} onChange={nd=>upTrip("departureDate",nd.date)}/></div>
              <div><div className="lbl">Duración reunión</div>
                <select className="sel" value={roadshow.trip.meetingDuration||60} onChange={e=>upTrip("meetingDuration",parseInt(e.target.value))}>
                  {[[30,"30 min"],[45,"45 min"],[60,"1 hora"],[90,"1h 30min"],[120,"2 horas"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select></div>
              <div><div className="lbl">Contacto LS</div>
                <select className="sel" value={roadshow.trip.lsContactIdx||0} onChange={e=>upTrip("lsContactIdx",parseInt(e.target.value))}>
                  {(config.contacts||[]).length?config.contacts.map((c,i)=><option key={i} value={i}>{c.name}</option>):<option value={0}>Configurar en ⚙ Config</option>}
                </select></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10,marginBottom:10}}>
              <div><div className="lbl">Dirección de nuestras oficinas</div><input className="inp" value={roadshow.trip.officeAddress} onChange={e=>upTrip("officeAddress",e.target.value)} placeholder="Arenales 707, 6° Piso, CABA"/></div>
              <div><div className="lbl">Notas</div><input className="inp" value={roadshow.trip.notes} onChange={e=>upTrip("notes",e.target.value)} placeholder="Sector de interés..."/></div>
            </div>

            {/* Resend email key */}
            <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center",marginBottom:10,background:"rgba(30,90,176,.03)",border:"1px solid rgba(30,90,176,.1)",borderRadius:7,padding:"10px 12px"}}>
              <div>
                <div className="lbl" style={{marginBottom:3}}>✉️ Resend API Key <span style={{fontWeight:400,color:"var(--dim)"}}>(para enviar emails directo desde la app)</span></div>
                <input className="inp" style={{fontFamily:"IBM Plex Mono,monospace",fontSize:11}} type="password"
                  value={roadshow.trip.resendKey||""} onChange={e=>upTrip("resendKey",e.target.value)}
                  placeholder="re_xxxxxxxxxxxxxxxxxxxx"/>
              </div>
              <div style={{fontSize:10,color:"var(--dim)",lineHeight:1.5,maxWidth:180}}>
                Sin key: copia el texto.<br/>
                Con key: envía directo al inversor.<br/>
                <a href="https://resend.com/api-keys" target="_blank" style={{color:"var(--gold)"}}>Obtener key →</a>
              </div>
            </div>


            {/* Visitors */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <div className="lbl" style={{margin:0}}>👥 Visitantes del fondo</div>
                <button className="btn bo bs" style={{fontSize:9,padding:"2px 8px"}} onClick={()=>{const v=(roadshow.trip.visitors||[]);saveRoadshow({...roadshow,trip:{...roadshow.trip,visitors:[...v,{name:"",title:"",email:""}]}});}}>+ Agregar</button>
              </div>
              {(roadshow.trip.visitors||[]).map((v,vi)=>(
                <div key={vi} style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                  <input className="inp" style={{flex:2,fontSize:11,padding:"3px 7px"}} value={v.name} placeholder="Nombre" onChange={e=>{const vs=[...(roadshow.trip.visitors||[])];vs[vi]={...vs[vi],name:e.target.value};upTrip("visitors",vs);}}/>
                  <input className="inp" style={{flex:1.5,fontSize:11,padding:"3px 7px"}} value={v.title||""} placeholder="Cargo / Fund" onChange={e=>{const vs=[...(roadshow.trip.visitors||[])];vs[vi]={...vs[vi],title:e.target.value};upTrip("visitors",vs);}}/>
                  <input className="inp" style={{flex:2,fontSize:11,padding:"3px 7px"}} value={v.email||""} placeholder="email@fondo.com" onChange={e=>{const vs=[...(roadshow.trip.visitors||[])];vs[vi]={...vs[vi],email:e.target.value};upTrip("visitors",vs);}}/>
                  <button aria-label="Eliminar visitante" className="btn bd bs" style={{fontSize:9,padding:"2px 6px",flexShrink:0}} onClick={()=>{const vs=(roadshow.trip.visitors||[]).filter((_,j)=>j!==vi);upTrip("visitors",vs);}}>✕</button>
                </div>
              ))}
              {!(roadshow.trip.visitors||[]).length&&<div style={{fontSize:11,color:"var(--dim)"}}>Agregá los representantes del fondo que visitan Argentina — aparecen en los emails y el ICS.</div>}
            </div>
            {/* Email parser */}
            <div style={{borderTop:"1px solid rgba(30,90,176,.08)",paddingTop:10}}>
              <button className="btn bo bs" style={{fontSize:10,gap:5,marginBottom:rsShowParser?8:0}} onClick={()=>setRsShowParser(s=>!s)}>
                {rsShowParser?"▲ Cerrar":"▼ 📧 Parsear email del inversor"}
              </button>
              {rsShowParser&&(
                <div style={{marginTop:6}}>
                  <textarea className="inp" style={{width:"100%",minHeight:110,fontSize:11,fontFamily:"monospace",marginBottom:6,resize:"vertical"}}
                    placeholder={"Pegá el email del inversor aquí...\nEj: We will be arriving on 18 April and leaving on 24 April...\nBanco Macro\nYPF\n..."}
                    value={rsEmailParser} onChange={e=>setRsEmailParser(e.target.value)}/>
                  <button className="btn bg bs" style={{fontSize:11,gap:5}} onClick={()=>{
                    if(!rsEmailParser.trim()) return;
                    const result=handleRsEmailParse(rsEmailParser);
                    const{patchTrip,matchedCos}=result;
                    let msg="";
                    const newTrip={...roadshow.trip,...patchTrip};
                    if(patchTrip.arrivalDate) msg+=`✅ Fechas: ${patchTrip.arrivalDate} al ${patchTrip.departureDate}\n`;
                    if(patchTrip.hotel) msg+=`✅ Hotel: ${patchTrip.hotel}\n`;
                    if(matchedCos.length) msg+=`✅ ${matchedCos.length} empresa(s) encontrada(s): ${matchedCos.map(c=>c.name).join(", ")}`;
                    const newCos=[...roadshow.companies,...matchedCos];
                    saveRoadshow({...roadshow,trip:newTrip,companies:newCos});
                    toast(msg||"No se encontraron datos para extraer. Verificá el formato del email.");
                    if(msg){setRsShowParser(false);setRsEmailParser("");}
                  }}>🔍 Extraer fechas, hotel y empresas</button>
                </div>
              )}
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="rs-subtabs" style={{display:"flex",gap:0,marginBottom:14,borderBottom:"1px solid rgba(30,90,176,.1)",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
            {[["schedule","📅 Agenda"],["bookings",`📬 Reservas${pendingCount>0?" ("+pendingCount+")":""}`],["investor","👤 Inversor"],["companies","🏢 Empresas"],["travel","🗺️ Recorrido"],["expenses","💰 Gastos"],["emails","✉️ Emails"],["export","📄 Exportar"],["activitylog","🕐 Historial"]].map(([id,lbl])=>(
              <button key={id} className={`ntab${rsSubTab===id?" on":""}`} style={{height:38,fontSize:10,position:"relative",flexShrink:0}} onClick={()=>setRsSubTab(id)}>{lbl}{id==="bookings"&&pendingCount>0&&rsSubTab!=="bookings"&&<span style={{position:"absolute",top:4,right:4,width:8,height:8,borderRadius:"50%",background:"#ef4444"}}/>}</button>
            ))}
            <div className="rs-subtabs-stats" style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10,paddingBottom:4,paddingRight:4,flexShrink:0}}>
              <span style={{fontSize:10,color:"var(--grn)",fontFamily:"IBM Plex Mono,monospace"}}>{confirmed} ✓</span>
              <span style={{fontSize:10,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>{tentative} ⏳</span>
            </div>
          </div>

          <div className="tab-enter" key={rsSubTab}>
          {/* AGENDA */}
          {rsSubTab==="schedule"&&(
            <div>
              {/* Legend + add button */}
              <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
                <button className="btn bo bs" style={{fontSize:9,padding:"2px 8px",marginRight:4}} onClick={()=>{
                  const tent=(roadshow.meetings||[]).filter(m=>m.status==="tentative").length;
                  if(!tent){toast("No hay reuniones tentativas.");return;}
                  if(!confirm(`¿Confirmar ${tent} reunión(es) tentativa(s)?`)) return;
                  const now=new Date().toISOString();
                  const updated=(roadshow.meetings||[]).map(m=>m.status==="tentative"?{...m,status:"confirmed",changeLog:[...(m.changeLog||[]),{at:now,field:"status",from:"tentative",to:"confirmed"}]}:m);
                  saveRoadshow({...roadshow,meetings:updated});
                }}>✅ Confirmar todas</button>
                {[...new Set([...roadshow.companies.filter(c=>c.active).map(c=>c.sector),"LS Internal"])].map(s=>(
                  <div key={s} style={{display:"flex",alignItems:"center",gap:3,fontSize:9,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>
                    <div style={{width:7,height:7,borderRadius:1,background:RS_CLR[s]||"#666"}}/>
                    {s}
                  </div>
                ))}
                {/* Day filter pills */}
                <div style={{display:"flex",gap:3,alignItems:"center",flexWrap:"wrap"}}>
                  <button
                    className={`btn bs ${!rsDayFilter?"bg":"bo"}`}
                    style={{fontSize:8,padding:"2px 8px"}}
                    onClick={()=>setRsDayFilter(null)}>
                    Todos
                  </button>
                  {tripDays.filter(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;}).map(d=>{
                    const dd=new Date(d+"T12:00:00");
                    const today=new Date().toISOString().slice(0,10);
                    const isToday=d===today;
                    const lbl=dd.toLocaleDateString("es-AR",{weekday:"short",day:"numeric"});
                    return(
                      <button key={d}
                        className={`btn bs ${rsDayFilter===d?"bg":"bo"}`}
                        style={{fontSize:8,padding:"2px 8px",position:"relative",
                          ...(isToday?{borderColor:"#1e5ab0",fontWeight:700}:{})}}
                        onClick={()=>setRsDayFilter(prev=>prev===d?null:d)}>
                        {isToday?"📅 Hoy":lbl}
                      </button>
                    );
                  })}
                </div>
                <div style={{marginLeft:"auto",display:"flex",gap:4,alignItems:"center"}}>
                  <div style={{display:"flex",borderRadius:5,overflow:"hidden",border:"1px solid rgba(30,90,176,.18)"}}>
                    <button style={{padding:"3px 8px",fontSize:9,border:"none",cursor:"pointer",fontFamily:"IBM Plex Mono,monospace",background:agendaView==="table"?"#1e5ab0":"transparent",color:agendaView==="table"?"#fff":"var(--dim)"}} onClick={()=>setAgendaView("table")} title="Vista tabla">▤</button>
                    <button style={{padding:"3px 8px",fontSize:9,border:"none",borderLeft:"1px solid rgba(30,90,176,.18)",cursor:"pointer",fontFamily:"IBM Plex Mono,monospace",background:agendaView==="calendar"?"#1e5ab0":"transparent",color:agendaView==="calendar"?"#fff":"var(--dim)"}} onClick={()=>{setAgendaView("calendar");setRsDayFilter(null);}} title="Vista calendario">📅</button>
                  </div>
                  <button className="btn bo bs" style={{fontSize:9,gap:4,borderColor:"rgba(30,90,176,.3)"}} title="Modo día — vista simplificada para celular"
                    onClick={()=>{
                      const today=new Date().toISOString().slice(0,10);
                      const todayMtgs=(roadshow.meetings||[]).filter(m=>m.date===today&&m.status!=="cancelled").sort((a,b)=>a.hour-b.hour);
                      const targetDate=todayMtgs.length?today:(rsDayFilter||(tripDays.find(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;})||tripDays[0]));
                      if(!targetDate){toast("Configurá las fechas del viaje primero.");return;}
                      setRsDayFilter(targetDate);setKioskIdx(0);setKioskMode(true);
                    }}>📱 Modo día</button>
                  <button className="btn bg bs" style={{fontSize:9,gap:4}} onClick={()=>{const firstWork=tripDays.find(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;})||tripDays[0];if(!firstWork){toast("Configurá las fechas del viaje primero.");return;}setRsMtgModal({date:firstWork,hour:9,meeting:null});}}>+ Nueva reunión</button>
                  <button className="btn bo bs" style={{fontSize:9,gap:4}} onClick={()=>rsMtgsExcelRef.current?.click()}>📥 Importar Excel</button>
                  {roadshow.meetings.length>0&&<button className="btn bd bs" style={{fontSize:9,gap:4}} onClick={()=>{if(confirm(`¿Borrar las ${roadshow.meetings.length} reunión(es) del roadshow? Esta acción no se puede deshacer.`))saveRoadshow({...roadshow,meetings:[]});}}>🗑 Borrar todo</button>}
                  <button className="btn bo bs" style={{fontSize:9,gap:4,opacity:.7}} title="Columnas: Fecha | Día | Hora | Compañía | Tipo | Dirección/Lugar | Estado | Notas" onClick={async()=>{
                    const header=["Fecha","Día","Hora","Compañía","Tipo","Dirección / Lugar","Estado","Notas"];
                    const rows=[
                      ["20/04/2026","Lun",9,"TGS","Company Visit","Cecilia Grierson 355, Piso 26, CABA","✅ Confirmado","Rodrigo Nistor"],
                      ["20/04/2026","Lun",10.5,"Pampa Energía","Company Visit","Maipú 1, CABA","✅ Confirmado","Rodrigo Nistor"],
                      ["21/04/2026","Mar",9,"YPF","Company Visit","Macacha Güemes 515, CABA","✅ Confirmado","Rodrigo Nistor"],
                    ];
                    const XLSX=await getXLSX();
                    const ws=XLSX.utils.aoa_to_sheet([header,...rows]);
                    // Add data validation dropdown for Hora column (col C = index 2)
                    // Hours 8-20 in 30min intervals as numbers (9, 9.5, 10, 10.5...)
                    const VALID_HOURS=[8,8.5,9,9.5,10,10.5,11,11.5,12,12.5,13,13.5,14,14.5,15,15.5,16,16.5,17,17.5,18,18.5,19,19.5,20];
                    const hourFormula='"'+VALID_HOURS.join(",")+'"';
                    ws["!dataValidation"]=[
                      {sqref:"C2:C100",type:"list",formula1:hourFormula,showDropDown:false,showErrorMessage:true,
                       errorTitle:"Hora inválida",error:"Usá el dropdown: 9=9am, 9.5=9:30am, 13=1pm, 13.5=1:30pm, etc."}
                    ];
                    // Format hora cells as numbers
                    for(let r=1;r<10;r++){const cell=XLSX.utils.encode_cell({r,c:2});if(ws[cell])ws[cell].t="n";}
                    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Reuniones");
                    XLSX.writeFile(wb,"Plantilla_Reuniones.xlsx");
                  }}>📋 Plantilla</button>
                </div>
              </div>

              {/* Week Calendar View */}
              {agendaView==="calendar"&&tripDays.length>0&&(
                <WeekCalendar
                  tripDays={tripDays}
                  meetings={roadshow.meetings||[]}
                  companies={roadshow.companies||[]}
                  meetingDuration={roadshow.trip.meetingDuration||60}
                  rsCoById={rsCoById}
                  onClickMeeting={m=>setRsMtgModal({date:m.date,hour:m.hour,meeting:m})}
                  onClickSlot={({date,hour})=>setRsMtgModal({date,hour,meeting:null})}
                />
              )}

              {/* Table grid (original view) */}
              {tripDays.length===0?(
                <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)"}}>
                  <div style={{fontSize:32,marginBottom:8}}>📅</div>
                  <div style={{fontSize:14,color:"var(--cream)"}}>Configurá las fechas del viaje para ver el calendario</div>
                </div>
              ):(
                <>
                {rsDayFilter&&(()=>{
                  const dayMtgs=(roadshow.meetings||[]).filter(m=>m.date===rsDayFilter&&m.status!=="cancelled").sort((a,b)=>a.hour-b.hour);
                  const dayDate=new Date(rsDayFilter+"T12:00:00");
                  const DN=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
                  const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
                  return(
                    <div style={{marginBottom:12}}>
                      <div className="day-hdr-bar" style={{background:"#000039",borderRadius:10,padding:"14px 18px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div>
                          <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:9,color:"rgba(255,255,255,.45)",letterSpacing:".15em",textTransform:"uppercase",marginBottom:4}}>{DN[dayDate.getDay()]} · {dayDate.toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"})}</div>
                          <div style={{fontFamily:"Playfair Display,serif",fontSize:18,color:"#fff",fontWeight:400}}>Agenda del día</div>
                        </div>
                        <div style={{textAlign:"right",display:"flex",alignItems:"center",gap:14}}>
                          {weather&&<div style={{fontSize:10,color:"rgba(255,255,255,.6)",fontFamily:"IBM Plex Mono,monospace",textAlign:"right",lineHeight:1.4}}>
                            <div>{weather.desc}</div><div style={{color:"rgba(255,255,255,.4)"}}>{weather.temp}</div>
                          </div>}
                          <div>
                          <div style={{fontSize:22,fontWeight:700,color:"#fff",fontFamily:"Playfair Display,serif"}}>{dayMtgs.length}</div>
                          <div style={{fontSize:9,color:"rgba(255,255,255,.4)",fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".1em"}}>reuniones</div>
                          </div>
                        </div>
                      </div>
                      {dayMtgs.length>0&&(
                        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                          {/* A3: Bulk confirm day */}
                          {dayMtgs.some(m=>m.status==="tentative")&&<button className="btn bo bs" style={{fontSize:9,gap:4}} onClick={()=>{
                            const tent=dayMtgs.filter(m=>m.status==="tentative").length;
                            const now2=new Date().toISOString();
                            const updated=(roadshow.meetings||[]).map(m=>m.date===rsDayFilter&&m.status==="tentative"?{...m,status:"confirmed",changeLog:[...(m.changeLog||[]),{at:now2,field:"status",from:"tentative",to:"confirmed"}]}:m);
                            saveRoadshow({...roadshow,meetings:updated});
                            toastOk(`✅ ${tent} reunión(es) confirmadas`);
                          }}>✅ Confirmar día ({dayMtgs.filter(m=>m.status==="tentative").length})</button>}
                          {/* A4: Copy day agenda to clipboard */}
                          <button className="btn bo bs" style={{fontSize:9,gap:4}} onClick={()=>{
                            const dayLabel2=dayDate.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
                            const lines=dayMtgs.map(m=>{const co2=m.type==="company"?rsCoById.get(m.companyId):null;const name2=co2?.name||(m.lsType||m.title||"Reunión");const loc=m.location==="ls_office"?(roadshow.trip.officeAddress||"Oficinas LS"):m.location==="hq"?(co2?.hqAddress||"HQ"):(m.locationCustom||"TBD");return`${fmtH(m.hour)} · ${name2} · 📍 ${loc} · ${m.status==="confirmed"?"✅":"◌"}`;});
                            const txt=`📅 *Agenda ${dayLabel2}*\n${roadshow.trip.fund||""}\n\n${lines.join("\n")}`;
                            navigator.clipboard.writeText(txt).then(()=>toastOk("✅ Agenda del día copiada"));
                          }}>📋 Copiar agenda</button>
                          <button className="btn bo bs" style={{fontSize:9,gap:4,display:"inline-flex",alignItems:"center"}} onClick={()=>{
                            const visitors=(roadshow.trip.visitors||[]).filter(v=>v.name).map(v=>v.name.split(" ")[0]).join(" y ");
                            const fund=roadshow.trip.fund||roadshow.trip.clientName||"Latin Securities";
                            const dayLabel=dayDate.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
                            const items=[];
                            dayMtgs.forEach(m=>{
                              const co=m.type==="company"?rsCoById.get(m.companyId):null;
                              if(!co) return;
                              const allC=co.contacts||[];
                              const selIds=m.attendeeIds||[];
                              const reps=(selIds.length?allC.filter(c=>selIds.includes(c.id)):allC).filter(c=>c.name);
                              const locStr=m.location==="ls_office"?(roadshow.trip.officeAddress||"Oficinas LS"):m.location==="hq"?(co.hqAddress||co.name+" HQ"):(m.locationCustom||"A confirmar");
                              reps.forEach(r=>{
                                if(!r.phone) return;
                                const firstName=r.name.split(" ")[0];
                                const msg=`Hola ${firstName}, buen día 👋\n\nTe escribo para confirmar la reunión de mañana:\n\n📅 *${co.name}*\n🗓 ${dayLabel}\n🕐 ${fmtH(m.hour)} hs\n📍 ${locStr}\n👤 ${visitors||fund}\n\n¿Nos confirmás asistencia?\n\nSaludos,\n${lsCont.name||fund}`;
                                const digits=r.phone.replace(/[^\d]/g,"");
                                items.push({contact:r,company:co,meeting:m,message:msg,waUrl:"https://wa.me/"+digits+"?text="+encodeURIComponent(msg)});
                              });
                            });
                            if(items.length===0){setWaBulkModal({date:rsDayFilter,dateLabel:dayLabel,items:[],empty:true});return;}
                            setWaBulkModal({date:rsDayFilter,dateLabel:dayLabel,items});
                          }}>💬 WhatsApp Bulk</button>
                        </div>
                      )}
                      {dayMtgs.length===0?(<EmptyState icon="calendar" title="Sin reuniones este día" subtitle="Hacé click en la grilla o usá + Nueva reunión para agendar."/>):(
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                          {dayMtgs.map((m)=>{
                            const co=m.type==="company"?rsCoById.get(m.companyId):null;
                            const clr=m.type==="company"?(RS_CLR[co?.sector]||"#666"):"#23a29e";
                            const allC=co?.contacts||[];
                            const selIds=m.attendeeIds||[];
                            const reps=(selIds.length?allC.filter(r=>selIds.includes(r.id)):allC).filter(r=>r.name);
                            const locStr=m.location==="ls_office"?(roadshow.trip.officeAddress||"LS Offices"):m.location==="hq"?(co?co.hqAddress||co.name+" HQ":"HQ"):(m.locationCustom||"TBD");
                            const isConf=m.status==="confirmed";
                            return(
                              <div key={m.id} className="mtg-day-card" onClick={()=>setRsMtgModal({date:m.date,hour:m.hour,meeting:m})}
                                style={{background:"#fff",border:`1px solid ${clr}30`,borderRadius:10,padding:"14px 16px",cursor:"pointer",position:"relative",overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,57,.04)",transition:"all .15s"}}
                                onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 4px 16px ${clr}22`;e.currentTarget.style.borderColor=`${clr}55`;}}
                                onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,57,.04)";e.currentTarget.style.borderColor=`${clr}30`;}}>
                                <div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:clr}}/>
                                <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                                  <div style={{minWidth:60,textAlign:"center",paddingTop:2}}>
                                    <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:15,fontWeight:700,color:"#000039",lineHeight:1}}>{fmtH(m.hour)}</div>
                                    <div style={{fontSize:8,color:"#9ca3af",marginTop:3,fontFamily:"IBM Plex Mono,monospace"}}>{roadshow.trip.meetingDuration||60}m</div>
                                  </div>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                                      {co&&<div style={{width:26,height:26,borderRadius:4,background:clr,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7.5,fontWeight:700,color:"#fff",fontFamily:"IBM Plex Mono,monospace",flexShrink:0}}>{co.ticker?.slice(0,4)}</div>}
                                      <div style={{fontFamily:"Playfair Display,serif",fontSize:14,fontWeight:700,color:"#000039",lineHeight:1.2}}>{co?co.name:(m.lsType||m.title||"Reunión interna")}</div>
                                    </div>
                                    {reps.length>0&&<div style={{fontSize:10,color:"#374151",marginBottom:3}}>{reps.map(r=>r.name+(r.title?" · "+r.title:"")).join(" — ")}</div>}
                                    <div style={{fontSize:10,color:"#6b7280"}}>📍 {locStr}{m.meetingFormat&&m.meetingFormat!=="Meeting"?" · 🍽 "+m.meetingFormat:""}</div>
                                    {m.notes&&<div style={{fontSize:10,color:"#6b7280",marginTop:4,paddingTop:4,borderTop:"1px solid #f3f4f6",lineHeight:1.5}}>📋 {m.notes}</div>}
                                    {m.postNotes&&<div style={{fontSize:10,color:"#166534",marginTop:3,lineHeight:1.5}}>✅ {m.postNotes}</div>}
                                  </div>
                                  <span style={{flexShrink:0,padding:"3px 9px",borderRadius:5,fontSize:8.5,fontWeight:600,background:isConf?"#dcfce7":"#fef9c3",color:isConf?"#166534":"#854d0e"}}>{isConf?"✓ Conf.":"◌ Tent."}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
                <div style={{overflowX:"auto",borderRadius:8,border:"1px solid rgba(30,90,176,.1)",boxShadow:"0 1px 4px rgba(30,90,176,.05)",marginBottom:14}}>
                  <table style={{borderCollapse:"collapse",width:"100%"}}>
                    <colgroup>
                      <col style={{width:46}}/>
                      {tripDays.map(d=><col key={d} style={{minWidth:92}}/>)}
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{background:"rgba(30,90,176,.04)",padding:"5px 3px",borderBottom:"2px solid rgba(30,90,176,.12)",fontSize:8,color:"var(--dim)"}}></th>
                        {(rsDayFilter?tripDays.filter(d=>d===rsDayFilter):tripDays).map(date=>{
                          const d=new Date(date+"T12:00:00");
                          const isWE=d.getDay()===0||d.getDay()===6;
                          const DN=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
                          return(
                            <th key={date} style={{background:isWE?"rgba(30,90,176,.02)":"#1e5ab0",color:isWE?"var(--dim)":"#fff",borderBottom:"2px solid rgba(30,90,176,.12)",padding:"4px 3px",textAlign:"center"}}>
                              <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:7.5,letterSpacing:".08em",marginBottom:1}}>{DN[d.getDay()]}</div>
                              <div style={{fontSize:14,fontWeight:700,lineHeight:1}}>{d.getDate()}</div>
                              <div style={{fontSize:7,opacity:.75}}>Abr</div>
                            </th>);
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {(()=>{
                        // Build skip map: cells occupied by a rowspan from a meeting above
                        // skip[date][slotIndex] = true if covered by a prior rowspan
                        const skip={};
                        (rsDayFilter?tripDays.filter(d=>d===rsDayFilter):tripDays).forEach(date=>{skip[date]={};});
                        ROADSHOW_HOURS.forEach((h,hi)=>{
                          (rsDayFilter?tripDays.filter(d=>d===rsDayFilter):tripDays).forEach(date=>{
                            if(skip[date][hi]) return;
                            const mtg=rsBySlot[`${date}-${h}`];
                            if(mtg){
                              const rows=Math.max(1,Math.round((mtg.duration||60)/30));
                              for(let r=1;r<rows;r++){
                                if(hi+r<ROADSHOW_HOURS.length) skip[date][hi+r]=true;
                              }
                            }
                          });
                        });
                        const visibleDays=rsDayFilter?tripDays.filter(d=>d===rsDayFilter):tripDays;
                    return ROADSHOW_HOURS.map((h,hi)=>(
                          <tr key={h} style={{height:28}}>
                            <td style={{background:"rgba(30,90,176,.02)",borderRight:"2px solid rgba(30,90,176,.07)",textAlign:"right",padding:"2px 5px 2px 2px",fontSize:8.5,color:h%1===0?"var(--dim)":"rgba(120,140,170,.4)",fontFamily:"IBM Plex Mono,monospace",verticalAlign:"top",paddingTop:3,whiteSpace:"nowrap"}}>
                              {h%1===0?fmtHour(h):"·"}
                            </td>
                            {visibleDays.map(date=>{
                              if(skip[date][hi]) return null;
                              const d=new Date(date+"T12:00:00");
                              const isWE=d.getDay()===0||d.getDay()===6;
                              const mtg=rsBySlot[`${date}-${h}`];
                              const co=mtg?.type==="company"?rsCoById.get(mtg.companyId):null;
                              const clr=mtg?(mtg.type==="company"?(RS_CLR[co?.sector]||"#666"):"#23a29e"):null;
                              const lbl=mtg?(mtg.type==="company"?(co?.ticker||"?"):(mtg.lsType?.split(" – ").pop()?.slice(0,9)||mtg.title?.slice(0,9)||"Int")):"";
                              const rows=mtg?Math.max(1,Math.round((mtg.duration||60)/30)):1;
                              const rowH=rows*28;
                              return(
                                <td key={date}
                                  rowSpan={rows}
                                  onClick={()=>{if(dragMtg)return;!isWE&&setRsMtgModal({date,hour:h,meeting:mtg||null});}}
                                  onDragOver={e=>{
                                    if(!dragMtg||mtg||isWE) return;
                                    e.preventDefault();
                                    const dur2=roadshow.trip.meetingDuration||60;
                                    const endH=h+dur2/60;
                                    // Check for conflicts with other meetings on this day
                                    const dayMtgs=(roadshow.meetings||[]).filter(m=>m.date===date&&m.status!=="cancelled"&&m.id!==dragMtg.id);
                                    const conflict=dayMtgs.some(m=>{const mEnd=m.hour+(m.duration||dur2)/60;return(h<mEnd&&endH>m.hour);});
                                    // Check gap to nearest meeting
                                    const nextMtg=dayMtgs.filter(m=>m.hour>=endH).sort((a,b)=>a.hour-b.hour)[0];
                                    const prevMtg=dayMtgs.filter(m=>(m.hour+(m.duration||dur2)/60)<=h).sort((a,b)=>b.hour-a.hour)[0];
                                    const gapToNext=nextMtg?Math.round((nextMtg.hour-endH)*60):null;
                                    const tight=gapToNext!==null&&gapToNext<30;
                                    e.currentTarget.style.background=conflict?"rgba(220,38,38,.2)":tight?"rgba(234,179,8,.15)":"rgba(30,90,176,.18)";
                                    // Show hint via title
                                    e.currentTarget.title=conflict?"⚠ Conflicto: se superpone con otra reunión":tight?`⚡ Ajustado: ${gapToNext} min hasta la siguiente`:"✓ Disponible";
                                  }}
                                  onDragLeave={e=>{e.currentTarget.style.background="";e.currentTarget.title="";}}
                                  onDrop={e=>{
                                    e.currentTarget.style.background="";e.currentTarget.title="";
                                    if(!dragMtg||mtg||isWE) return;
                                    // Warn on conflict
                                    const dur2=roadshow.trip.meetingDuration||60;
                                    const endH2=h+dur2/60;
                                    const dayMtgs2=(roadshow.meetings||[]).filter(m=>m.date===date&&m.status!=="cancelled"&&m.id!==dragMtg.id);
                                    const hasConflict=dayMtgs2.some(m=>{const mEnd=m.hour+(m.duration||dur2)/60;return(h<mEnd&&endH2>m.hour);});
                                    if(hasConflict&&!confirm("⚠ Esta reunión se superpone con otra. ¿Mover igual?")){setDragMtg(null);return;}
                                    const updated=(roadshow.meetings||[]).map(m=>m.id===dragMtg.id?{...m,date,hour:h,changeLog:[...(m.changeLog||[]),{at:new Date().toISOString(),field:"moved",from:`${dragMtg.origDate} ${fmtHour(dragMtg.origHour)}`,to:`${date} ${fmtHour(h)}`}]}:m);
                                    saveRoadshow({...roadshow,meetings:updated});
                                    // Auto-recalculate travel for affected days
                                    if(calcDayTravel){
                                      calcDayTravel(date);
                                      if(dragMtg.origDate!==date) calcDayTravel(dragMtg.origDate);
                                    }
                                    setDragMtg(null);
                                  }}
                                  style={{border:"1px solid rgba(30,90,176,.05)",background:isWE?"rgba(0,0,0,.015)":mtg?`${clr}18`:"transparent",cursor:isWE?"default":"pointer",padding:mtg?2:1,verticalAlign:"top",height:mtg?rowH:28}}>
                                  {mtg&&<div title={`${mtg.type==="company"?(co?.name||"?"):(mtg.lsType||mtg.title||"Reunión")} · ${fmtHour(h)} · Click para editar`} draggable onDragStart={()=>setDragMtg({id:mtg.id,origDate:date,origHour:h})} onDragEnd={()=>setDragMtg(null)} style={{background:clr,color:"#fff",borderRadius:4,padding:"3px 5px",fontSize:9,fontWeight:700,height:rowH-6,overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"space-between",gap:1,outline:rsOverlapSet.has(mtg.id)?"2px solid #e05050":undefined,outlineOffset:"-2px",cursor:"pointer",opacity:dragMtg?.id===mtg.id?.4:1,transition:"filter .1s"}}
                                    onMouseEnter={e=>e.currentTarget.style.filter="brightness(1.15)"}
                                    onMouseLeave={e=>e.currentTarget.style.filter=""}>
                                    <div style={{display:"flex",alignItems:"center",gap:3,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                                      {mtg.postNotes&&<span title="Tiene notas post-reunión" style={{fontSize:6,opacity:.8}}>📝</span>}
                                      <span>{lbl}</span>
                                      <span 
                                        style={{fontSize:7,cursor:"pointer",padding:"1px 3px",borderRadius:2,background:mtg.status==="confirmed"?"rgba(0,0,0,.2)":"transparent"}}
                                        title={mtg.status==="confirmed"?"Click para marcar tentativa":"Click para confirmar"}
                                        onClick={e=>{
                                          e.stopPropagation();
                                          const next=mtg.status==="confirmed"?"tentative":"confirmed";
                                          const updated=(roadshow.meetings||[]).map(m=>m.id===mtg.id?{...m,status:next}:m);
                                          saveRoadshow({...roadshow,meetings:updated});
                                        }}>
                                        {mtg.status==="confirmed"?"✓":"○"}
                                      </span>
                                      {mtg.status==="cancelled"&&<span style={{fontSize:7,opacity:.7}}>✗</span>}
                                    </div>
                                    {rows>=2&&<div style={{fontSize:7.5,opacity:.8,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{fmtHour(h)}–{fmtHour(h+(mtg.duration||60)/60)}</div>}
                                  </div>}
                                  {!mtg&&!isWE&&(()=>{
                                  // Check if this is a gap slot between two meetings — show travel info
                                  const dayMtgsSorted=[...(roadshow.meetings||[])].filter(m=>m.date===date&&m.status!=="cancelled").sort((a,b)=>a.hour-b.hour);
                                  const prevMtgIdx=dayMtgsSorted.findIndex(m=>{
                                    const mEnd=m.hour+(m.duration||60)/60;
                                    return mEnd<=h && (m.hour+(m.duration||60)/60)===h;
                                  });
                                  // Find which pair index this gap belongs to
                                  let travelInfo=null;
                                  for(let pi=0;pi<dayMtgsSorted.length-1;pi++){
                                    const mA=dayMtgsSorted[pi];
                                    const mB=dayMtgsSorted[pi+1];
                                    const aEnd=mA.hour+(mA.duration||60)/60;
                                    // This slot is in the gap between mA and mB
                                    if(h>=aEnd&&h<mB.hour){
                                      const dayT=travelCache[date]||{};
                                      const _chipKey=`${date}-${pi}`;
                                      const _chipOverrideSec=roadshow.travelOverrides?.[_chipKey];
                                      const _chipDeptH=mA.hour+(mA.duration||60)/60;
                                      travelInfo=dayT[_chipKey]||((_chipOverrideSec!=null)?{...applyBATraffic(_chipOverrideSec,_chipDeptH,null),source:"manual"}:null);
                                      // Only show on first gap slot
                                      if(h===aEnd) break;
                                      else {travelInfo=null;break;}
                                    }
                                  }
                                  return travelInfo?(
                                    <div style={{fontSize:7.5,color:"#23a29e",fontFamily:"IBM Plex Mono,monospace",padding:"1px 3px",lineHeight:1.3,overflow:"hidden",whiteSpace:"nowrap"}}>
                                      🚗 {travelInfo.durationText}
                                    </div>
                                  ):(
                                    <div style={{fontSize:11,color:"rgba(30,90,176,.08)",textAlign:"center",lineHeight:"24px",userSelect:"none"}}>+</div>
                                  );
                                })()}
                                </td>);
                            })}
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div></>
              )}

              {/* Meeting list */}
              {roadshow.meetings.length>0&&(
                <div>
                  <div className="sec-hdr" style={{marginBottom:8}}>📋 Todas las reuniones</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    {[...roadshow.meetings].sort((a,b)=>a.date.localeCompare(b.date)||a.hour-b.hour).map(m=>{
                      const co=m.type==="company"?rsCoById.get(m.companyId):null;
                      const clr=m.type==="company"?(RS_CLR[co?.sector]||"#666"):"#23a29e";
                      const d=new Date(m.date+"T12:00:00");
                      const dayStr=d.toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"});
                      const locL=m.location==="ls_office"?"LS":m.location==="hq"?(co?co.ticker+" HQ":"HQ"):(m.locationCustom||"Otro");
                      return(
                        <div key={m.id} style={{border:`1px solid ${clr}44`,borderRadius:7,padding:"8px 11px",background:`${clr}08`,display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}
                          onClick={()=>setRsMtgModal({date:m.date,hour:m.hour,meeting:m})}>
                          <div style={{width:34,height:34,borderRadius:6,background:clr,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:8.5,fontWeight:700,fontFamily:"IBM Plex Mono,monospace",textAlign:"center",flexShrink:0,lineHeight:1.2}}>{co?.ticker||"LS"}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:700,color:"var(--cream)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{co?co.name:(m.lsType||m.title||"Reunión")}</div>
                            <div style={{fontSize:10,color:"var(--dim)",marginTop:1}}>{dayStr} · {m.hour}:00 · {locL}</div>
                          </div>
                          <div style={{fontSize:9,padding:"2px 6px",borderRadius:4,flexShrink:0,fontFamily:"IBM Plex Mono,monospace",background:m.status==="confirmed"?"rgba(58,140,92,.12)":m.status==="cancelled"?"rgba(214,68,68,.10)":"rgba(30,90,176,.08)",color:m.status==="confirmed"?"var(--grn)":m.status==="cancelled"?"var(--red)":"var(--dim)"}}>
                            {m.status==="confirmed"?"✓":m.status==="cancelled"?"✗":"⏳"}
                          </div>
                        </div>);
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* RESERVAS ONLINE */}
          {rsSubTab==="bookings"&&(
            <div>
              <div className="sec-hdr" style={{marginBottom:10}}>📬 Reservas online</div>
              {bookingsLoading?<div style={{display:"flex",flexDirection:"column",gap:10}}>{[1,2,3].map(i=><SkeletonCard key={i} lines={2}/>)}</div>:(
                bookings.length===0?<div className="card"><EmptyState icon="inbox" title="Sin reservas online" subtitle="Publicá el link de reserva desde la pestaña Exportar para que las empresas agenden reuniones."/></div>:(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {["pending","approved","rejected"].map(status=>{
                      const group=bookings.filter(b=>b.status===status);
                      if(!group.length)return null;
                      const labels={pending:"⏳ Pendientes",approved:"✅ Aprobadas",rejected:"❌ Rechazadas"};
                      return(<div key={status}>
                        <div style={{fontSize:11,fontWeight:700,color:"var(--dim)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6,fontFamily:"IBM Plex Mono,monospace"}}>{labels[status]} ({group.length})</div>
                        {group.map(b=>{
                          const fmtH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
                          const dayLabel=b.slot_date?new Date(b.slot_date+"T12:00:00").toLocaleDateString("es-AR",{weekday:"short",day:"numeric",month:"short"}):"";
                          return(
                            <div key={b.id} className="card" style={{padding:"14px 16px",marginBottom:8,borderLeft:`4px solid ${status==="pending"?"#f59e0b":status==="approved"?"#22c55e":"#ef4444"}`}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                                <div>
                                  <div style={{fontSize:14,fontWeight:700,color:"#000039"}}>{b.company}</div>
                                  <div style={{fontSize:11,color:"#374151"}}>{b.contact_name} · {b.email}{b.phone?" · "+b.phone:""}</div>
                                </div>
                                <div style={{textAlign:"right"}}>
                                  <div style={{fontSize:12,fontWeight:700,fontFamily:"IBM Plex Mono,monospace"}}>{dayLabel} · {fmtH(b.slot_hour)} hs</div>
                                  <div style={{fontSize:9,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>{b.confirm_code}</div>
                                </div>
                              </div>
                              {b.location_pref&&<div style={{fontSize:10,color:"#6b7280"}}>📍 {b.location_pref==="ls_office"?"Oficinas LS":b.location_pref==="hq"?"Sede empresa":"Otro"}{b.notes?" · 📋 "+b.notes:""}</div>}
                              {status==="pending"&&(
                                <div style={{display:"flex",gap:6,marginTop:10}}>
                                  <button className="btn bg bs" style={{fontSize:9}} onClick={async()=>{
                                    await supabase.from("roadshow_bookings").update({status:"approved",reviewed_at:new Date().toISOString()}).eq("id",b.id);
                                    // Create meeting in roadshow
                                    const coMatch=(roadshow.companies||[]).find(c=>c.name.toLowerCase()===b.company.toLowerCase().trim());
                                    let coId=coMatch?.id;
                                    if(!coId){
                                      coId="co_"+Date.now();
                                      const newCo={id:coId,name:b.company,hqAddress:"",ticker:"",sector:"",contacts:[{id:"rep_"+Date.now(),name:b.contact_name,title:"",email:b.email,phone:b.phone||""}]};
                                      saveRoadshow({...roadshow,companies:[...(roadshow.companies||[]),newCo],meetings:[...(roadshow.meetings||[]),{id:"mtg_"+Date.now(),date:b.slot_date,hour:b.slot_hour,companyId:coId,type:"company",status:"confirmed",location:b.location_pref||"ls_office",locationCustom:"",notes:"Reserva online: "+b.confirm_code,postNotes:"",meetingFormat:"Meeting",attendeeIds:[],feedback:{},icsVersion:1}]});
                                    }else{
                                      saveRoadshow({...roadshow,meetings:[...(roadshow.meetings||[]),{id:"mtg_"+Date.now(),date:b.slot_date,hour:b.slot_hour,companyId:coId,type:"company",status:"confirmed",location:b.location_pref||"ls_office",locationCustom:"",notes:"Reserva online: "+b.confirm_code,postNotes:"",meetingFormat:"Meeting",attendeeIds:[],feedback:{},icsVersion:1}]});
                                    }
                                    fetchBookings();fetchPendingCount();
                                  }}>✅ Aprobar + crear reunión</button>
                                  <button className="btn bo bs" style={{fontSize:9}} onClick={async()=>{
                                    await supabase.from("roadshow_bookings").update({status:"approved",reviewed_at:new Date().toISOString()}).eq("id",b.id);
                                    fetchBookings();fetchPendingCount();
                                  }}>✓ Aprobar</button>
                                  <button className="btn bo bs" style={{fontSize:9,color:"#ef4444",borderColor:"#fecaca"}} onClick={async()=>{
                                    await supabase.from("roadshow_bookings").update({status:"rejected",reviewed_at:new Date().toISOString()}).eq("id",b.id);
                                    fetchBookings();fetchPendingCount();
                                  }}>✗ Rechazar</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>);
                    })}
                  </div>
                )
              )}
            </div>
          )}

          {/* EMPRESAS */}
          {/* VISTA POR INVERSOR */}
          {rsSubTab==="investor"&&(()=>{
            const visitors=(roadshow.trip.visitors||[]).filter(v=>v.name);
            const fund=roadshow.trip.fund||roadshow.trip.clientName||"Inversor";
            const rmMap=new Map((roadshow.companies||[]).map(c=>[c.id,c]));
            const sortedMtgs=[...(roadshow.meetings||[])].filter(m=>m.status!=="cancelled").sort((a,b)=>a.date.localeCompare(b.date)||a.hour-b.hour);
            const byDay={};
            sortedMtgs.forEach(m=>{if(!byDay[m.date])byDay[m.date]=[];byDay[m.date].push(m);});
            const days=Object.keys(byDay).sort();
            const fmtDay=iso=>new Date(iso+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
            const STATUS_CLR={confirmed:"#3a8c5c",tentative:"#e8850a",cancelled:"#b03030"};
            const STATUS_LBL={confirmed:"✅ Confirmado",tentative:"⏳ Tentativo",cancelled:"❌ Cancelado"};
            return(
            <div>
              <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8}}>
                <button className="btn bo bs" style={{fontSize:10}} onClick={()=>{const e=rsToEntity(roadshow,roadshow.companies);if(!e){toast("Sin reuniones.");return;}const meta={...config,eventTitle:(roadshow.trip.fund||roadshow.trip.clientName||"Roadshow"),eventType:"Latin Securities · Roadshow",eventDates:tripDays.length?`${new Date(tripDays[0]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${new Date(tripDays[tripDays.length-1]+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`:""};openPrint(buildPrintHTML([e],meta));}}>📄 PDF agenda</button>
              </div>
              {/* Header card */}
              <div style={{background:"linear-gradient(135deg,#1e5ab0 0%,#23a29e 100%)",borderRadius:12,padding:"20px 24px",marginBottom:20,color:"#fff"}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                  <div>
                    <div style={{fontFamily:"Playfair Display,serif",fontSize:22,marginBottom:4}}>{fund}</div>
                    <div style={{fontSize:12,opacity:.85,marginBottom:8}}>
                      {roadshow.trip.arrivalDate&&roadshow.trip.departureDate?`${new Date(roadshow.trip.arrivalDate+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"long"})} – ${new Date(roadshow.trip.departureDate+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"})}`:""}</div>
                    {visitors.length>0&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {visitors.map((v,i)=>(
                        <div key={i} style={{background:"rgba(255,255,255,.15)",borderRadius:6,padding:"4px 10px",fontSize:11}}>
                          <span style={{fontWeight:700}}>{v.name}</span>{v.title&&<span style={{opacity:.8}}> · {v.title}</span>}
                        </div>
                      ))}
                    </div>}
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:28,fontWeight:700,lineHeight:1}}>{sortedMtgs.filter(m=>m.status==="confirmed").length}</div>
                    <div style={{fontSize:11,opacity:.75}}>reuniones confirmadas</div>
                    <div style={{fontSize:11,opacity:.6,marginTop:2}}>{sortedMtgs.length} total</div>
                  </div>
                </div>
              </div>

              {/* Day-by-day agenda */}
              {days.length===0&&(
                <div style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)"}}>
                  <div style={{fontSize:36,marginBottom:8}}>📅</div>
                  <div style={{fontSize:14,color:"var(--cream)"}}>No hay reuniones confirmadas aún</div>
                  <div style={{fontSize:12,marginTop:4}}>Agregá reuniones en la tab 📅 Agenda</div>
                </div>
              )}
              {days.map(date=>{
                const dayMtgs=byDay[date];
                const d=new Date(date+"T12:00:00");
                const isWE=d.getDay()===0||d.getDay()===6;
                return(
                  <div key={date} style={{marginBottom:16}}>
                    <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:11,fontWeight:700,color:"var(--cream)",textTransform:"capitalize",marginBottom:8,paddingBottom:5,borderBottom:"2px solid rgba(30,90,176,.12)",display:"flex",alignItems:"center",gap:8}}>
                      {fmtDay(date).charAt(0).toUpperCase()+fmtDay(date).slice(1)}
                      {isWE&&<span style={{fontSize:9,background:"rgba(232,133,10,.15)",color:"#e8850a",padding:"1px 6px",borderRadius:4}}>Fin de semana</span>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {dayMtgs.map((m,mi)=>{
                        const co=m.type==="company"?rmMap.get(m.companyId):null;
                        const clr=m.type==="company"?(RS_CLR[co?.sector]||"#666"):"#23a29e";
                        const addr=getMeetingAddress(m,co,roadshow.trip.officeAddress);
                        const cleanedAddr=stripNeighborhood(addr);
                        const nextM=mi<dayMtgs.length-1?dayMtgs[mi+1]:null;
                        const gap=nextM?Math.round((nextM.hour-m.hour)*60-(m.duration||60)):null;
                        return(
                          <div key={m.id} style={{display:"flex",gap:0,alignItems:"stretch"}}>
                            {/* Time column */}
                            <div style={{width:52,flexShrink:0,paddingTop:12,textAlign:"right",paddingRight:12}}>
                              <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:11,fontWeight:700,color:clr}}>{fmtHour(m.hour)}</div>
                              <div style={{fontSize:9,color:"var(--dim)",marginTop:1}}>{m.duration||60}min</div>
                            </div>
                            {/* Card */}
                            <div style={{flex:1,background:"#fff",border:`1px solid ${clr}33`,borderLeft:`3px solid ${clr}`,borderRadius:"0 8px 8px 0",padding:"10px 14px",position:"relative"}}>
                              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                                <div>
                                  <div style={{fontSize:13,fontWeight:700,color:"var(--cream)",marginBottom:2}}>
                                    {co?co.name:(m.lsType||m.title||"Reunión")}
                                    {co?.ticker&&<span style={{fontFamily:"IBM Plex Mono,monospace",fontSize:9,color:"#fff",background:clr,padding:"1px 5px",borderRadius:3,marginLeft:5}}>{co.ticker}</span>}
                                  </div>
                                  <div style={{fontSize:10,color:"var(--dim)",display:"flex",alignItems:"center",gap:5}}>
                                    <span>📍</span><span>{cleanedAddr}</span>
                                  </div>
                                  {m.type==="company"&&(()=>{
                                    const allR=co?.contacts||[];const sel=m.attendeeIds?.length?allR.filter(r=>m.attendeeIds.includes(r.id)):allR;
                                    const reps=sel.filter(r=>r.name).map(r=>r.name+(r.title?" ("+r.title+")":"")).join(", ");
                                    return reps?<div style={{fontSize:10,color:"var(--dim)",marginTop:3}}>👤 {reps}</div>:null;
                                  })()}
                                  {m.participants&&<div style={{fontSize:10,color:"var(--dim)",marginTop:3}}>👤 {m.participants}</div>}
                                </div>
                                <div style={{flexShrink:0,textAlign:"right"}}>
                                  <div style={{fontSize:10,fontWeight:600,color:STATUS_CLR[m.status]||"#666"}}>{STATUS_LBL[m.status]||m.status}</div>
                                  {m.meetingFormat&&m.meetingFormat!=="Meeting"&&<div style={{fontSize:9,color:"var(--dim)",marginTop:2}}>{m.meetingFormat}</div>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            );
          })()}

          {/* COMPANIES */}
          {rsSubTab==="companies"&&(
            <div>
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                <button className="btn bo bs" style={{fontSize:10}} onClick={()=>{const ns={id:`rc_${Date.now()}`,name:"Nueva empresa",ticker:"",sector:"Custom",location:"ls_office",contacts:[],hqAddress:"",notes:"",active:true};saveRoadshow({...roadshow,companies:[...roadshow.companies,ns]});}}>+ Agregar empresa</button>
                <button className="btn bg bs" style={{fontSize:10,gap:4}} onClick={()=>{
                  const dbCos=(globalDB.companies||[]);
                  if(!dbCos.length){toast("La Librería no tiene empresas. Agregá empresas en la tab 📚 Librería primero.");return;}
                  // Pre-select companies not already in roadshow
                  const existingNames=new Set((roadshow.companies||[]).map(c=>c.name.toLowerCase()));
                  setLibSelected(new Set(dbCos.filter(c=>!existingNames.has(c.name.toLowerCase())).map(c=>c.id)));
                  setLibSearch("");setLibPicker(true);
                }}>📚 Importar de Librería</button>
                <button className="btn bo bs" style={{fontSize:10,gap:4}} onClick={()=>{
                  const rsCos=(roadshow.companies||[]).filter(c=>c.name);
                  if(!rsCos.length){toast("No hay empresas para sincronizar.");return;}
                  const dbCos=[...(globalDB.companies||[])];
                  let added=0,updated=0;
                  rsCos.forEach(rc=>{
                    const existing=dbCos.findIndex(c=>c.name.toLowerCase()===rc.name.toLowerCase());
                    const libCo={id:existing>=0?dbCos[existing].id:`dbc_${Date.now()}_${Math.random().toString(36).slice(2)}`,name:rc.name,ticker:rc.ticker||"",sector:rc.sector||"",hqAddress:rc.hqAddress||"",contacts:(rc.contacts||[]).map(ct=>({id:ct.id,name:ct.name||"",title:ct.title||"",email:ct.email||"",phone:ct.phone||""})),notes:rc.notes||""};
                    if(existing>=0){dbCos[existing]=libCo;updated++;}else{dbCos.push(libCo);added++;}
                  });
                  saveGlobalDB({...globalDB,companies:dbCos});
                  toastOk(`✅ Librería actualizada: ${added} nuevas, ${updated} actualizadas`);
                }}>↑ Sync a Librería</button>
                <button className="btn bo bs" style={{fontSize:10}} onClick={()=>saveRoadshow({...roadshow,companies:(roadshow.companies||[]).map(c=>({...c,active:true}))})}>Activar todas</button>
                <button className="btn bo bs" style={{fontSize:10}} onClick={()=>saveRoadshow({...roadshow,companies:(roadshow.companies||[]).map(c=>({...c,active:false}))})}>Desactivar todas</button>
                <button className="btn bo bs" style={{fontSize:10,gap:4}} onClick={()=>rsExcelRef.current?.click()}>📥 Importar Excel</button>
                <div style={{marginLeft:"auto",fontSize:11,color:"var(--dim)"}}>{roadshow.companies.filter(c=>c.active).length} activas de {roadshow.companies.length}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {(roadshow.companies||[]).map((co,ci)=>{
                  function setCo(f,v){const nc=[...roadshow.companies];nc[ci]={...nc[ci],[f]:v};saveRoadshow({...roadshow,companies:nc});}

                  const clr=RS_CLR[co.sector]||"#666";
                  const hasMtg=roadshow.meetings.some(m=>m.companyId===co.id);
                  return(
                    <div key={co.id} style={{border:`1px solid ${co.active?clr+"44":"rgba(30,90,176,.07)"}`,borderRadius:8,padding:"10px 12px",background:co.active?"#fff":"rgba(0,0,0,.01)",opacity:co.active?1:.6,transition:"all .15s"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:co.active?8:0}}>
                        <div style={{width:34,height:34,borderRadius:6,background:clr,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <input style={{background:"transparent",border:"none",color:"#fff",width:34,textAlign:"center",fontFamily:"IBM Plex Mono,monospace",fontSize:9,fontWeight:700,padding:0,outline:"none"}} value={co.ticker} placeholder="TKR" onChange={e=>setCo("ticker",e.target.value.toUpperCase())}/>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <input className="inp" style={{fontSize:12,fontWeight:600,padding:"3px 6px",marginBottom:3}} value={co.name} placeholder="Nombre empresa" onChange={e=>setCo("name",e.target.value)}/>
                          {co.name.length>=3&&(()=>{const dups=findDuplicates(co.name,[...roadshow.companies,...(globalDB.companies||[])],co.id);return dups.length?<div style={{fontSize:9,color:"#b45309",background:"#fef3c7",padding:"3px 8px",borderRadius:4,marginBottom:3}}>⚠ Posible duplicado: {dups.map(d=>d.name).join(", ")}</div>:null;})()}
                          <div style={{display:"flex",gap:4,alignItems:"center"}}>
                            <select className="sel" style={{fontSize:9,padding:"2px 4px",flex:1}} value={co.sector} onChange={e=>setCo("sector",e.target.value)}>
                              {Object.keys(RS_CLR).filter(s=>s!=="LS Internal").map(s=><option key={s} value={s}>{s}</option>)}
                            </select>
                            {hasMtg&&<span style={{fontSize:9,color:"var(--grn)",fontFamily:"IBM Plex Mono,monospace",flexShrink:0}}>✓ reunión</span>}
                          </div>
                        </div>
                        <button className={`btn bs ${co.active?"bg":"bo"}`} style={{fontSize:9,padding:"3px 7px",flexShrink:0}} onClick={()=>setCo("active",!co.active)}>{co.active?"Activa":"Off"}</button>
                      </div>
                      {co.active&&(
                        <>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                            <div>
                              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4}}>
                                <div className="lbl" style={{margin:0}}>👤 Representantes</div>
                                <button className="btn bo bs" style={{fontSize:8,padding:"1px 6px"}} onClick={()=>{const c=[...(co.contacts||[])];c.push({id:`rep_${Date.now()}`,name:"",title:"",email:"",phone:""});setCo("contacts",c);}}>+ Add</button>
                              </div>
                              {(co.contacts||[]).map((rep,ri)=>(
                                <div key={rep.id||ri} style={{borderRadius:5,border:"1px solid rgba(30,90,176,.1)",padding:"5px 6px",marginBottom:4,background:"rgba(30,90,176,.02)"}}>
                                  <div style={{display:"flex",gap:3,marginBottom:3}}>
                                    <input className="inp" style={{flex:2,fontSize:10,padding:"2px 5px"}} value={rep.name||""} placeholder="Nombre *" onChange={e=>{const c=[...(co.contacts||[])];c[ri]={...c[ri],name:e.target.value};setCo("contacts",c);}}/>
                                    <input className="inp" style={{flex:1.5,fontSize:10,padding:"2px 5px"}} value={rep.title||""} placeholder="Cargo" onChange={e=>{const c=[...(co.contacts||[])];c[ri]={...c[ri],title:e.target.value};setCo("contacts",c);}}/>
                                    <button aria-label="Eliminar representante" style={{background:"none",border:"none",cursor:"pointer",color:"var(--red)",fontSize:12,padding:"0 2px",flexShrink:0}} onClick={()=>{const c=(co.contacts||[]).filter((_,j)=>j!==ri);setCo("contacts",c);}}>✕</button>
                                  </div>
                                  <div style={{display:"flex",gap:3}}>
                                    <input className="inp" style={{flex:2,fontSize:10,padding:"2px 5px"}} value={rep.email||""} placeholder="email@empresa.com" onChange={e=>{const c=[...(co.contacts||[])];c[ri]={...c[ri],email:e.target.value};setCo("contacts",c);}}/>
                                    <input className="inp" style={{flex:1.5,fontSize:10,padding:"2px 5px"}} value={rep.phone||""} placeholder="+54 11..." onChange={e=>{const c=[...(co.contacts||[])];c[ri]={...c[ri],title:c[ri].title,phone:e.target.value};setCo("contacts",c);}}/>
                                  </div>
                                </div>
                              ))}
                              {!(co.contacts||[]).length&&<div style={{fontSize:10,color:"var(--dim)"}}>Sin representantes.</div>}
                            </div>
                            <div>
                              <div className="lbl" style={{marginBottom:2}}>Lugar de reunión</div>
                              <select className="sel" style={{fontSize:10,padding:"3px 6px",marginBottom:3}} value={co.location} onChange={e=>setCo("location",e.target.value)}>
                                <option value="ls_office">🏛 Oficinas LS</option>
                                <option value="hq">🏢 Sede empresa</option>
                                <option value="custom">📍 Otro</option>
                              </select>
                              {(co.location==="hq")&&(
                                <input className="inp" style={{fontSize:10,padding:"3px 6px",marginBottom:3}} value={co.hqAddress||""} placeholder="Dirección HQ..." onChange={e=>setCo("hqAddress",e.target.value)}/>
                              )}
                              {(co.location==="custom")&&<input className="inp" style={{fontSize:10,padding:"3px 6px",marginBottom:3}} value={co.locationCustom||""} placeholder="Otra dirección..." onChange={e=>setCo("locationCustom",e.target.value)}/>}
                              <textarea className="inp" style={{fontSize:10,padding:"3px 6px",minHeight:44,resize:"none"}} value={co.notes||""} placeholder="Notas..." onChange={e=>setCo("notes",e.target.value)}/>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:5}}>
                            {(()=>{
                              const coMtgs=(roadshow.meetings||[]).filter(m=>m.companyId===co.id&&m.type==="company");
                              const allConf=coMtgs.length>0&&coMtgs.every(m=>m.status==="confirmed");
                              const hasAnyTent=coMtgs.some(m=>m.status==="tentative");
                              return coMtgs.length>0&&(
                                <button
                                  className={`btn bs ${allConf?"bo":"bg"}`}
                                  style={{fontSize:9,flex:1,gap:3,
                                    background:allConf?"transparent":"rgba(22,101,52,.1)",
                                    borderColor:allConf?"rgba(22,101,52,.3)":"rgba(22,101,52,.5)",
                                    color:allConf?"var(--grn)":"#166534"}}
                                  title={allConf?"Todas confirmadas — click para marcar tentativas":"Confirmar todas las reuniones de "+co.name}
                                  onClick={()=>{
                                    const newStatus=allConf?"tentative":"confirmed";
                                    const now=new Date().toISOString();
                                    const updated=(roadshow.meetings||[]).map(m=>
                                      m.companyId===co.id&&m.type==="company"
                                        ?{...m,status:newStatus,changeLog:[...(m.changeLog||[]),{at:now,field:"status",from:m.status,to:newStatus}]}
                                        :m
                                    );
                                    saveRoadshow({...roadshow,meetings:updated});
                                  }}>
                                  {allConf?"✓ Todas conf.":"✅ Confirmar "+(coMtgs.length>1?coMtgs.length+" mtgs":"reunión")}
                                </button>
                              );
                            })()}
                            <button className="btn bo bs" style={{fontSize:9,flex:1,gap:3}} onClick={()=>{const email=genRSEmail(co,roadshow.trip,roadshow.meetings,lsCont,tripDays);setRsEmailModal({company:co,emailData:email});}}>✉️ Email</button>
                            <button className="btn bo bs" style={{fontSize:9,flex:1,gap:3}} title="Brief PDF para imprimir antes de la reunión" onClick={()=>exportCompanyBrief(co)}>📄 Brief</button>
                            <button className="btn bg bs" style={{fontSize:9,gap:3,flex:1}} onClick={()=>{const firstWork=tripDays.find(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;})||tripDays[0];if(!firstWork){toast("Configurá las fechas primero.");return;}setRsMtgModal({date:firstWork,hour:9,meeting:null,preCoId:co.id});}}>+ Reunión</button>
                            <button aria-label={`Eliminar ${co.name}`} className="btn bd bs" style={{fontSize:9,padding:"3px 7px"}} onClick={()=>{if(confirm(`Eliminar ${co.name}?`))saveRoadshow({...roadshow,companies:roadshow.companies.filter((_,j)=>j!==ci)});}}> ✕</button>
                          </div>
                        </>
                      )}
                    </div>);
                })}
              </div>
            </div>
          )}

          {/* EMAILS */}
          {rsSubTab==="travel"&&(()=>{
            const workDays=tripDays.filter(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;});
            const dur=roadshow.trip.meetingDuration||60;

            return(
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                <div>
                  <h3 style={{fontFamily:"Playfair Display,serif",fontSize:16,color:"var(--cream)",marginBottom:2}}>🗺️ Tiempos de traslado</h3>
                  <p style={{fontSize:12,color:"var(--dim)"}}>Verificá que haya tiempo suficiente entre reuniones considerando el traslado.</p>
                </div>
                              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{fontSize:11,background:"rgba(58,140,92,.07)",border:"1px solid rgba(58,140,92,.2)",borderRadius:6,padding:"5px 10px",color:"var(--dim)"}}>
                    🆓 Sin API key · rango estimado con tráfico CABA
                  </div>
                  <button className="btn bg bs" style={{fontSize:10,gap:5}} disabled={travelLoading} onClick={calcAllTravel}>
                    {travelLoading?"⏳ Calculando...":"🔄 Calcular todos los traslados"}
                  </button>
                </div>
              </div>

              {workDays.map(date=>{
                const dayMtgs=[...(roadshow.meetings||[])].filter(m=>m.date===date&&m.status!=="cancelled").sort((a,b)=>a.hour-b.hour);
                if(!dayMtgs.length) return null;
                const d=new Date(date+"T12:00:00");
                const dayLabel=d.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
                const dayTravel=travelCache[date]||{};

                return(
                  <div key={date} className="card" style={{marginBottom:12}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={{fontFamily:"IBM Plex Mono,monospace",fontSize:12,fontWeight:700,color:"var(--cream)",textTransform:"capitalize"}}>{dayLabel}</div>
                      <div style={{display:"flex",gap:6}}>
                        {dayMtgs.length>=2&&<button className="btn bo bs" style={{fontSize:9,gap:4}} disabled={travelLoading}
                          onClick={()=>calcDayTravel(date)}>
                          "🔄 Calcular tiempos"
                        </button>}
                        {dayMtgs.length>=2&&<button className="btn bo bs" style={{fontSize:9,gap:4}}
                          onClick={()=>{const addrs=dayMtgs.map(m=>{const co=m.type==="company"?rsCoMapForTravel.get(m.companyId):null;return getMeetingAddress(m,co,roadshow.trip.officeAddress);});openGoogleMapsRoute(addrs);}}>
                          🗺️ Abrir ruta
                        </button>}
                        <button className="btn bo bs" style={{fontSize:9,gap:4}}
                          onClick={()=>exportDriverItinerary(date)}>
                          🚗 Itinerario
                        </button>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div style={{position:"relative",paddingLeft:24}}>
                      {/* Vertical line */}
                      <div style={{position:"absolute",left:9,top:8,bottom:8,width:2,background:"rgba(30,90,176,.15)",borderRadius:1}}/>

                      {dayMtgs.map((m,mi)=>{
                        const co=m.type==="company"?rsCoMapForTravel.get(m.companyId):null;
                        const clr=m.type==="company"?(RS_CLR[co?.sector]||"#666"):"#23a29e";
                        const addr=getMeetingAddress(m,co,roadshow.trip.officeAddress);
                        const endHour=m.hour+Math.floor(dur/60);
                        const _travelKey=`${date}-${mi}`;
                        const _overrideSec=roadshow.travelOverrides?.[_travelKey];
                        const _deptH=m.hour+dur/60;
                        const travelData=mi<dayMtgs.length-1
                          ?(dayTravel[_travelKey]||((_overrideSec!=null)?{...applyBATraffic(_overrideSec,_deptH,null),source:"manual"}:null))
                          :null;
                        const nextM=mi<dayMtgs.length-1?dayMtgs[mi+1]:null;
                        const conflict=nextM?checkTravelConflict(m,nextM,travelData?.durationSec??null,dur):null;
                        return(
                          <div key={m.id}>
                            {/* Meeting block */}
                            <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:4}}>
                              <div style={{width:18,height:18,borderRadius:"50%",background:clr,flexShrink:0,marginTop:2,zIndex:1,boxShadow:"0 0 0 3px var(--ink)"}}/>
                              <div style={{flex:1,background:conflict?.conflict?"rgba(214,68,68,.06)":conflict?.warning?"rgba(232,133,10,.06)":"rgba(30,90,176,.03)",borderRadius:7,padding:"8px 11px",border:`1px solid ${conflict?.conflict?"rgba(214,68,68,.2)":conflict?.warning?"rgba(232,133,10,.2)":"rgba(30,90,176,.08)"}`}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                                  <div>
                                    <span style={{fontFamily:"IBM Plex Mono,monospace",fontWeight:700,fontSize:11,color:clr}}>{fmtHour(m.hour||0)}</span>
                                    <span style={{fontSize:11,color:"var(--dim)",marginLeft:4}}>({dur} min)</span>
                                    <span style={{fontWeight:700,fontSize:13,color:"var(--cream)",marginLeft:8}}>{co?co.name:(m.lsType||m.title||"Meeting")}</span>
                                    {co&&<span style={{fontFamily:"IBM Plex Mono,monospace",fontSize:9,color:"#fff",background:clr,padding:"1px 5px",borderRadius:3,marginLeft:5}}>{co.ticker}</span>}
                                  </div>
                                  <button style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:"var(--dim)",padding:"0 0 0 8px",whiteSpace:"nowrap",flexShrink:0}}
                                    aria-label="Ver en Maps"
                                    onClick={()=>{const prev=mi>0?getMeetingAddress(dayMtgs[mi-1],mi>0&&dayMtgs[mi-1].type==="company"?rmMap.get(dayMtgs[mi-1].companyId):null,roadshow.trip.officeAddress):null;if(prev)openGoogleMapsDirections(prev,addr);else window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`,"_blank");}}>
                                    🗺️
                                  </button>
                                </div>
                                <div style={{fontSize:10,color:"var(--dim)",marginTop:3,display:"flex",alignItems:"center",gap:5}}>
                                  <span>📍</span>
                                  <span style={{fontStyle:addr.includes("TBD")?"italic":"normal",color:addr.includes("TBD")?"var(--red)":"var(--dim)"}}>{addr||"Sin dirección"}</span>
                                  {!addr&&<span style={{color:"var(--red)",fontSize:9}}>⚠ Falta dirección</span>}
                                </div>
                              </div>
                            </div>

                            {/* Travel gap indicator */}
                            {nextM&&(
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,paddingLeft:2}}>
                                <div style={{width:16,display:"flex",justifyContent:"center"}}><div style={{width:1,height:20,background:conflict?.conflict?"var(--red)":conflict?.warning?"#e8850a":"rgba(30,90,176,.15)"}}/></div>
                                <div style={{flex:1,display:"flex",alignItems:"center",gap:6,fontSize:10,flexWrap:"wrap"}}>
                                  {editingLeg?.date===date&&editingLeg?.idx===mi?(
                                    /* ── inline manual input ── */
                                    <>
                                      <span style={{color:"var(--dim)"}}>🚗 Tiempo base (min):</span>
                                      <input
                                        autoFocus
                                        type="number" min="1" max="120"
                                        value={editLegVal}
                                        onChange={e=>setEditLegVal(e.target.value)}
                                        onKeyDown={e=>{
                                          if(e.key==="Enter"){
                                            const v=parseInt(editLegVal);
                                            if(v>0){
                                              const overrides={...(roadshow.travelOverrides||{}),[_travelKey]:v*60};
                                              saveRoadshow({...roadshow,travelOverrides:overrides});
                                              // Also update travelCache so it shows immediately
                                              setTravelCache(prev=>({...prev,[date]:{...(prev[date]||{}),
                                                [_travelKey]:{...applyBATraffic(v*60,_deptH,null),source:"manual"}}}));
                                            }
                                            setEditingLeg(null);
                                          }
                                          if(e.key==="Escape") setEditingLeg(null);
                                        }}
                                        style={{width:56,padding:"2px 6px",borderRadius:4,border:"1px solid var(--gold)",background:"var(--ink3)",color:"var(--cream)",fontFamily:"IBM Plex Mono,monospace",fontSize:11}}
                                      />
                                      <button className="btn bg bs" style={{fontSize:9,padding:"2px 8px"}}
                                        onClick={()=>{
                                          const v=parseInt(editLegVal);
                                          if(v>0){
                                            const overrides={...(roadshow.travelOverrides||{}),[_travelKey]:v*60};
                                            saveRoadshow({...roadshow,travelOverrides:overrides});
                                            setTravelCache(prev=>({...prev,[date]:{...(prev[date]||{}),
                                              [_travelKey]:{...applyBATraffic(v*60,_deptH,null),source:"manual"}}}));
                                          }
                                          setEditingLeg(null);
                                        }}>✓</button>
                                      <button className="btn bo bs" style={{fontSize:9,padding:"2px 8px"}} onClick={()=>setEditingLeg(null)}>✕</button>
                                      <span style={{fontSize:9,color:"var(--dim)"}}>Se aplica tráfico CABA → rango</span>
                                    </>
                                  ):travelData?(
                                    <>
                                      <span style={{fontFamily:"IBM Plex Mono,monospace",color:conflict?.conflict?"var(--red)":conflict?.warning?"#e8850a":"var(--grn)",fontWeight:700}}>🚗 {travelData.durationText}</span>
                                      {travelData.distanceText&&<span style={{color:"var(--dim)"}}>· {travelData.distanceText}</span>}
                                      {travelData.source==="osrm+traffic"&&<span style={{fontSize:8,color:"#6ee7b7",fontFamily:"IBM Plex Mono,monospace",padding:"1px 4px",border:"1px solid rgba(110,231,183,.3)",borderRadius:3}}>tráfico BA est.</span>}
                                      {travelData.source==="manual"&&<span style={{fontSize:8,color:"var(--gold)",fontFamily:"IBM Plex Mono,monospace",padding:"1px 4px",border:"1px solid rgba(234,179,8,.3)",borderRadius:3}}>manual</span>}
                                      {conflict?.conflict&&<span style={{color:"var(--red)",fontWeight:700}}>⚠ CONFLICTO — solo {conflict.gapMin} min entre reuniones</span>}
                                      {conflict?.warning&&!conflict.conflict&&<span style={{color:"#e8850a"}}>⚡ Justo — {conflict.gapMin} min de margen</span>}
                                      {!conflict&&<span style={{color:"var(--grn)"}}>✓ OK ({Math.floor((nextM.hour*60)-(m.hour*60+dur)-travelData.durationSec/60)} min de margen)</span>}
                                      <button title="Editar tiempo de traslado" onClick={()=>{setEditLegVal(String(Math.round((travelData.baseSec||travelData.durationSec)/60)));setEditingLeg({date,idx:mi});}}
                                        style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:"var(--dim)",padding:"0 2px",lineHeight:1}}>✏️</button>
                                    </>
                                  ):(
                                    <>
                                      <span style={{color:"var(--dim)",fontStyle:"italic"}}>
                                        {Math.round((nextM.hour-m.hour)*60-dur)} min entre reuniones
                                      </span>
                                      <button className="btn bo bs" style={{fontSize:9,gap:3,padding:"2px 8px"}}
                                        onClick={()=>{setEditLegVal("10");setEditingLeg({date,idx:mi});}}>
                                        ✏️ Ingresar manualmente
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {workDays.every(d=>!(roadshow.meetings||[]).some(m=>m.date===d&&m.status!=="cancelled"))&&(
                <div className="card" style={{textAlign:"center",padding:"40px 20px",color:"var(--dim)"}}>
                  <div style={{fontSize:32,marginBottom:8}}>🗺️</div>
                  <div style={{fontSize:14,color:"var(--cream)"}}>Agregá reuniones en 📅 Agenda para ver el análisis de traslados</div>
                </div>
              )}
            </div>
            );
          })()}
          {/* GASTOS / EXPENSES */}
          {rsSubTab==="expenses"&&(()=>{
            const expenses=roadshow.expenses||[];
            const CATS=EXPENSE_CATS;
            const CURRENCIES=EXPENSE_CURRENCIES;
            const addExpense=()=>{
              if(!expForm.amount||!expForm.description.trim())return;
              const exp={id:"exp-"+Date.now(),date:expForm.date,category:expForm.category,description:expForm.description.trim(),amount:parseFloat(expForm.amount),currency:expForm.currency,paidBy:expForm.paidBy.trim(),notes:expForm.notes.trim(),receipt:expForm.receipt||null,receiptName:expForm.receiptName||null,createdAt:new Date().toISOString()};
              if(expEdit){
                saveRoadshow({...roadshow,expenses:expenses.map(e=>e.id===expEdit?{...exp,id:expEdit}:e)});setExpEdit(null);
              }else{
                saveRoadshow({...roadshow,expenses:[...expenses,exp]});
              }
              setExpForm({...expForm,description:"",amount:"",notes:"",receipt:null,receiptName:null});
            };
            const delExpense=id=>{saveRoadshow({...roadshow,expenses:expenses.filter(e=>e.id!==id)});};
            const byCurrency={};expenses.forEach(e=>{byCurrency[e.currency]=(byCurrency[e.currency]||0)+e.amount;});
            const byCategory={};expenses.forEach(e=>{byCategory[e.category]=(byCategory[e.category]||0)+e.amount;});
            const fmtAmt=(n,cur)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:cur,minimumFractionDigits:0,maximumFractionDigits:2}).format(n);
            return(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div className="sec-hdr" style={{margin:0,border:"none",paddingBottom:0}}>💰 Gastos del roadshow</div>
                  {expenses.length>0&&<button className="btn bo bs" style={{fontSize:9}} onClick={async()=>{
                    const XLSX=await getXLSX();if(!XLSX)return;
                    const rows=[["Fecha","Categoría","Descripción","Monto","Moneda","Pagó","Notas","Comprobante"],...expenses.map(e=>[e.date,e.category,e.description,e.amount,e.currency,e.paidBy||"",e.notes||"",e.receiptName||""])];
                    const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[{wch:12},{wch:16},{wch:30},{wch:12},{wch:8},{wch:16},{wch:30},{wch:20}];
                    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Gastos");
                    // Add totals by currency
                    const totRows=[[""],["TOTALES POR MONEDA"],...Object.entries(byCurrency).map(([cur,t])=>["",cur,"","",t])];
                    XLSX.utils.sheet_add_aoa(ws,totRows,{origin:-1});
                    XLSX.writeFile(wb,`Gastos_${(roadshow.trip.fund||"Roadshow").replace(/[^a-zA-Z0-9]/g,"_")}.xlsx`);
                    toastOk("✅ Gastos exportados a Excel");
                  }}>📥 Exportar Excel</button>}
                  {expenses.length>0&&<button className="btn bo bs" style={{fontSize:9}} onClick={()=>{
                    const fund=roadshow.trip.fund||roadshow.trip.clientName||"Roadshow";
                    const fmtAmt2=(n,cur)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:cur,minimumFractionDigits:0}).format(n);
                    const now2=new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"long",year:"numeric"});
                    const rows=expenses.sort((a,b)=>a.date.localeCompare(b.date)).map(e=>`<tr><td style="padding:6px 10px;font-family:monospace;font-size:10pt;white-space:nowrap">${new Date(e.date+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"short"})}</td><td style="padding:6px 10px;font-size:10pt">${e.category}</td><td style="padding:6px 10px;font-size:10pt">${e.description}${e.notes?" — "+e.notes:""}</td><td style="padding:6px 10px;text-align:right;font-weight:700;font-family:monospace;font-size:10pt">${fmtAmt2(e.amount,e.currency)}</td><td style="padding:6px 10px;font-size:9pt;color:#6b7280">${e.paidBy||""}</td>${e.receipt?`<td style="padding:6px 10px;font-size:9pt"><a href="${e.receipt}" target="_blank">📎</a></td>`:`<td></td>`}</tr>`).join("");
                    const totals=Object.entries(byCurrency).map(([cur,t])=>`<tr style="font-weight:700;background:#f0f4f8"><td colspan="3" style="padding:8px 10px;text-align:right">Total ${cur}</td><td style="padding:8px 10px;text-align:right;font-family:monospace">${fmtAmt2(t,cur)}</td><td colspan="2"></td></tr>`).join("");
                    const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Gastos — ${fund}</title><style>*{box-sizing:border-box;margin:0;padding:0}@page{margin:15mm}body{font-family:Calibri,sans-serif;font-size:11pt;color:#111;padding:20px}h1{font-size:16pt;color:#000039;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#000039;color:#fff;padding:8px 10px;text-align:left;font-size:9pt;text-transform:uppercase;letter-spacing:.06em}td{border-bottom:1px solid #e9eef5}.footer{margin-top:24px;font-size:8pt;color:#9ca3af;display:flex;justify-content:space-between}</style></head><body><h1>Gastos — ${fund}</h1><div style="font-size:10pt;color:#6b7280;margin-bottom:16px">Generado el ${now2} · ${expenses.length} gastos</div><table><thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th style="text-align:right">Monto</th><th>Pagó</th><th></th></tr></thead><tbody>${rows}${totals}</tbody></table><div class="footer"><span>Latin Securities · Confidential</span><span>${fund}</span></div></body></html>`;
                    openPrint(html);
                  }}>📄 Exportar PDF</button>}
                </div>
                {/* Totals */}
                {Object.keys(byCurrency).length>0&&(
                  <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                    {Object.entries(byCurrency).map(([cur,total])=>(
                      <div key={cur} style={{background:"#fff",border:"1px solid rgba(30,90,176,.1)",borderRadius:8,padding:"10px 16px",textAlign:"center"}}>
                        <div style={{fontSize:20,fontWeight:700,color:"#000039",fontFamily:"Playfair Display,serif"}}>{fmtAmt(total,cur)}</div>
                        <div style={{fontSize:8,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace",textTransform:"uppercase",letterSpacing:".1em",marginTop:2}}>{cur}</div>
                      </div>
                    ))}
                  </div>
                )}
                {/* Form */}
                <div className="card" style={{marginBottom:14}}>
                  <div style={{display:"grid",gridTemplateColumns:"auto 1fr 1fr auto auto",gap:8,alignItems:"end"}}>
                    <div><div className="lbl">Fecha</div><input type="date" className="inp" style={{width:130}} value={expForm.date} onChange={e=>setExpForm({...expForm,date:e.target.value})}/></div>
                    <div><div className="lbl">Descripción *</div><input className="inp" placeholder="Ej: Almuerzo con Pampa" value={expForm.description} onChange={e=>setExpForm({...expForm,description:e.target.value})} onKeyDown={e=>e.key==="Enter"&&addExpense()}/></div>
                    <div><div className="lbl">Categoría</div><select className="sel" value={expForm.category} onChange={e=>setExpForm({...expForm,category:e.target.value})}>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                    <div><div className="lbl">Monto *</div><div style={{display:"flex",gap:4}}><input className="inp" type="number" step="0.01" style={{width:100}} placeholder="0.00" value={expForm.amount} onChange={e=>setExpForm({...expForm,amount:e.target.value})} onKeyDown={e=>e.key==="Enter"&&addExpense()}/><select className="sel" style={{width:70}} value={expForm.currency} onChange={e=>setExpForm({...expForm,currency:e.target.value})}>{CURRENCIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div></div>
                    <div><button className="btn bg bs" style={{marginBottom:1}} onClick={addExpense}>{expEdit?"✓ Guardar":"+ Agregar"}</button></div>
                  </div>
                  <div style={{display:"flex",gap:8,alignItems:"center",marginTop:8}}>
                    <label style={{display:"inline-flex",alignItems:"center",gap:5,cursor:"pointer",fontSize:10,color:"var(--gold)",fontFamily:"IBM Plex Mono,monospace",padding:"4px 10px",border:"1px solid rgba(30,90,176,.2)",borderRadius:5,background:"rgba(30,90,176,.04)"}}>
                      📎 {expForm.receipt?"Cambiar":"Adjuntar"} comprobante
                      <input type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={e=>{
                        const file=e.target.files?.[0];if(!file)return;
                        if(file.size>2*1024*1024){toast("El archivo es muy grande (máx 2 MB).");return;}
                        const reader=new FileReader();
                        reader.onload=ev=>setExpForm({...expForm,receipt:ev.target.result,receiptName:file.name});
                        reader.readAsDataURL(file);
                        e.target.value="";
                      }}/>
                    </label>
                    {expForm.receipt&&<span style={{fontSize:10,color:"var(--dim)"}}>{expForm.receiptName} <button style={{background:"none",border:"none",color:"var(--red)",cursor:"pointer",fontSize:10}} onClick={()=>setExpForm({...expForm,receipt:null,receiptName:null})}>✕</button></span>}
                  </div>
                </div>
                {/* List */}
                {expenses.length===0?<div className="card"><EmptyState icon="money" title="Sin gastos registrados" subtitle="Usá el formulario de arriba para registrar transfers, comidas, hotel y más."/></div>:(
                  <div className="card" style={{padding:0,overflow:"hidden"}}>
                    <table className="tbl">
                      <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th style={{textAlign:"right"}}>Monto</th><th>Pagó</th><th></th></tr></thead>
                      <tbody>
                        {[...expenses].sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt?.localeCompare(b.createdAt||"")).map(e=>(
                          <tr key={e.id}>
                            <td style={{fontFamily:"IBM Plex Mono,monospace",fontSize:10,whiteSpace:"nowrap"}}>{new Date(e.date+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"short"})}</td>
                            <td style={{fontSize:11}}>{e.category}</td>
                            <td style={{fontSize:11}}>{e.description}{e.notes?<span style={{color:"var(--dim)",fontSize:10}}> — {e.notes}</span>:""}{e.receipt?<a href={e.receipt} target="_blank" rel="noopener noreferrer" style={{marginLeft:6,fontSize:9,color:"#1e5ab0",textDecoration:"none"}} title={e.receiptName||"Comprobante"}>📎</a>:""}</td>
                            <td style={{textAlign:"right",fontWeight:700,fontFamily:"IBM Plex Mono,monospace",fontSize:11}}>{fmtAmt(e.amount,e.currency)}</td>
                            <td style={{fontSize:10,color:"var(--dim)"}}>{e.paidBy||"—"}</td>
                            <td style={{whiteSpace:"nowrap"}}>
                              <button style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:"var(--dim)",padding:"2px 4px"}} onClick={()=>{setExpForm({date:e.date,category:e.category,description:e.description,amount:String(e.amount),currency:e.currency,paidBy:e.paidBy||"",notes:e.notes||"",receipt:e.receipt||null,receiptName:e.receiptName||null});setExpEdit(e.id);}}>✏️</button>
                              <button style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:"#dc2626",padding:"2px 4px"}} onClick={()=>delExpense(e.id)}>🗑</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Category breakdown */}
                {Object.keys(byCategory).length>1&&(
                  <div style={{marginTop:14}}>
                    <div className="sec-hdr" style={{marginBottom:8}}>Desglose por categoría</div>
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).map(([cat,total])=>{
                        const max=Math.max(...Object.values(byCategory));
                        const pct=max?Math.round(total/max*100):0;
                        return(<div key={cat} style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:130,fontSize:10,color:"var(--txt)",flexShrink:0}}>{cat}</div>
                          <div style={{flex:1,height:6,background:"#f0f3f8",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:pct+"%",background:"#1e5ab0",borderRadius:3}}/></div>
                          <div style={{width:80,textAlign:"right",fontSize:10,fontFamily:"IBM Plex Mono,monospace",color:"var(--txt)",flexShrink:0}}>{expenses.filter(e=>e.category===cat).length>0?fmtAmt(total,expenses.find(e=>e.category===cat)?.currency||"USD"):""}</div>
                        </div>);
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {rsSubTab==="emails"&&(
            <div>
              <div className="card" style={{marginBottom:12}}>
                <div className="card-t">✉️ Solicitudes de reunión — español</div>
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:14,lineHeight:1.6}}>Hacé clic en una empresa para ver el email personalizado con fechas, horarios libres y datos del cliente.</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {roadshow.companies.filter(c=>c.active).map(co=>{
                    const hasMtg=roadshow.meetings.some(m=>m.companyId===co.id);
                    const clr=RS_CLR[co.sector]||"#666";
                    return(
                      <button key={co.id} className="btn bo bs" style={{fontSize:11,gap:5,borderColor:`${clr}55`,background:hasMtg?`${clr}12`:"transparent"}}
                        onClick={()=>{const email=genRSEmail(co,roadshow.trip,roadshow.meetings,lsCont,tripDays);setRsEmailModal({company:co,emailData:email});}}>
                        <div style={{width:7,height:7,borderRadius:1,background:clr,flexShrink:0}}/>
                        {co.name}
                        {hasMtg&&<span style={{fontSize:9,color:"var(--grn)"}}>✓</span>}
                      </button>);
                  })}
                </div>
              </div>
              <div className="card" style={{background:"rgba(30,90,176,.02)"}}>
                <div className="card-t">💡 El email incluye automáticamente</div>
                <div style={{fontSize:12,color:"var(--txt)",lineHeight:1.9}}>
                  ✓ Los horarios disponibles (sin reunión asignada) &nbsp;·&nbsp; ✓ Nombre del cliente y fondo &nbsp;·&nbsp; ✓ Fechas y hotel &nbsp;·&nbsp; ✓ Lugar de la reunión (LS u otra) &nbsp;·&nbsp; ✓ Datos de contacto de {lsCont?.name||"el equipo LS"}
                </div>
              </div>

              {/* Email Templates */}
              <div className="sec-hdr" style={{marginTop:18,marginBottom:8}}>📋 Templates rápidos</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                {[
                  {id:"confirm",icon:"✅",title:"Confirmación de reunión",
                    gen:(co)=>{const mtg=(roadshow.meetings||[]).find(m=>m.companyId===co.id);const fmtH2=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};const dateStr=mtg?new Date(mtg.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}):"[date]";const visitors=(roadshow.trip.visitors||[]).filter(v=>v.name).map(v=>v.name).join(" and ")||roadshow.trip.fund;
                    return `Subject: Meeting Confirmation — ${co.name} & ${roadshow.trip.fund}\n\nDear team,\n\nWe are pleased to confirm the following meeting:\n\n📅 Date: ${dateStr}\n🕐 Time: ${mtg?fmtH2(mtg.hour):"[time]"} (Buenos Aires time)\n📍 Location: ${mtg?.location==="ls_office"?(roadshow.trip.officeAddress||"LS Offices"):co.hqAddress||"TBD"}\n👤 Attendees: ${visitors}\n\nPlease let us know if you need any changes.\n\nBest regards,\n${lsCont?.name||"Latin Securities"}\n${lsCont?.email||""}`;}},
                  {id:"followup",icon:"📞",title:"Follow-up post reunión",
                    gen:(co)=>{const visitors=(roadshow.trip.visitors||[]).filter(v=>v.name).map(v=>v.name.split(" ")[0]).join(" and ")||roadshow.trip.fund;
                    return `Subject: Follow-up — ${co.name} meeting\n\nDear team,\n\nThank you for taking the time to meet with ${visitors} during our Buenos Aires roadshow.\n\nAs discussed, we will:\n- [action item 1]\n- [action item 2]\n\nPlease don't hesitate to reach out if you need any additional information.\n\nBest regards,\n${lsCont?.name||"Latin Securities"}\n${lsCont?.email||""}`;}},
                  {id:"thankyou",icon:"🙏",title:"Thank you — fin del roadshow",
                    gen:(co)=>{const visitors=(roadshow.trip.visitors||[]).filter(v=>v.name).map(v=>v.name).join(" and ")||roadshow.trip.fund;const fund=roadshow.trip.fund||roadshow.trip.clientName||"our client";
                    return `Subject: Thank you — ${fund} Buenos Aires Roadshow\n\nDear team,\n\nOn behalf of ${visitors} and the Latin Securities team, we would like to thank you for the meeting during ${fund}'s visit to Buenos Aires.\n\nWe value the relationship and look forward to keeping you updated on future developments.\n\nWarm regards,\n${lsCont?.name||"Latin Securities"}\n${lsCont?.email||""}`;}},
                  {id:"reschedule",icon:"🔄",title:"Cambio de horario",
                    gen:(co)=>{const mtg=(roadshow.meetings||[]).find(m=>m.companyId===co.id);const fmtH2=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
                    return `Subject: Schedule Change — ${co.name} meeting\n\nDear team,\n\nWe need to adjust the timing of our meeting. The updated details are:\n\n📅 New date: ${mtg?new Date(mtg.date+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}):"[new date]"}\n🕐 New time: ${mtg?fmtH2(mtg.hour):"[new time]"}\n📍 Location: ${mtg?.location==="ls_office"?(roadshow.trip.officeAddress||"LS Offices"):co.hqAddress||"[location]"}\n\nWe apologize for any inconvenience and appreciate your flexibility.\n\nBest regards,\n${lsCont?.name||"Latin Securities"}\n${lsCont?.email||""}`;}},
                ].map(tmpl=>(
                  <div key={tmpl.id} className="card" style={{padding:"12px 14px",cursor:"default"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                      <span style={{fontSize:18}}>{tmpl.icon}</span>
                      <span style={{fontSize:12,fontWeight:700,color:"var(--cream)"}}>{tmpl.title}</span>
                    </div>
                    <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                      {roadshow.companies.filter(c=>c.active).slice(0,8).map(co=>{
                        const contacts=(co.contacts||[]).filter(c=>c.email);
                        const hasResend=!!roadshow.trip?.resendKey;
                        return(<div key={co.id} style={{display:"inline-flex",gap:2}}>
                          <button className="btn bo bs" style={{fontSize:9}} onClick={()=>{
                            const text=tmpl.gen(co);
                            navigator.clipboard.writeText(text).then(()=>toastOk(`✅ ${tmpl.title} para ${co.name} copiado`));
                          }}>{co.ticker||co.name.slice(0,8)}</button>
                          {hasResend&&contacts.length>0&&<button className="btn bo bs" style={{fontSize:9,padding:"2px 5px",color:"#1e5ab0"}} title={`Enviar a ${contacts.map(c=>c.email).join(", ")}`} onClick={async()=>{
                            const text=tmpl.gen(co);const subject=text.split("\n")[0].replace("Subject: ","");const body=text.split("\n").slice(2).join("\n");
                            const to=contacts.map(c=>c.email);
                            const from=lsCont?.email?.includes("latinsecurities")?`${lsCont.name} <${lsCont.email}>`:`Latin Securities <onboarding@resend.dev>`;
                            try{
                              const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${roadshow.trip.resendKey}`},body:JSON.stringify({from,to,subject,text:body,reply_to:lsCont?.email})});
                              if(res.ok)toastOk(`✅ Email enviado a ${to.join(", ")}`);else toastErr("Error: "+(await res.text()));
                            }catch(err){toastErr("Error de red: "+err.message);}
                          }}>📧</button>}
                        </div>);
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* EXPORT */}
          {rsSubTab==="export"&&(
            <div>
              {/* Send to investor */}
              <div className="card" style={{marginBottom:16,borderLeft:"3px solid var(--gold)",background:"rgba(30,90,176,.02)"}}>
                <div className="card-t" style={{marginBottom:6}}>📧 Enviar agenda al inversor</div>
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:10,lineHeight:1.6}}>
                  Generá el email con la agenda completa para enviar directamente a {(roadshow.trip.visitors||[]).length>0?`${roadshow.trip.visitors.map(v=>v.name.split(" ")[0]).join(" y ")} (${roadshow.trip.fund||roadshow.trip.clientName})`:"los visitantes"}.
                </p>
                <button className="btn bg bs" style={{gap:6}} onClick={()=>setRsAgendaEmailModal(true)}>
                  📧 Ver email con agenda
                </button>
              </div>
              {/* Daily briefing email */}
              <div className="card" style={{marginBottom:16,borderLeft:"3px solid #059669",background:"rgba(5,150,105,.03)"}}>
                <div className="card-t" style={{marginBottom:6}}>🌅 Agenda del día (para el cliente)</div>
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:10,lineHeight:1.6}}>
                  Generá el email <em>de mañana por la mañana</em> con el itinerario del día — solo las reuniones de ese día, con ubicaciones y contactos. Ideal para mandar antes de cada jornada.
                </p>
                <button className="btn bs" style={{gap:6,background:"rgba(5,150,105,.18)",border:"1px solid rgba(5,150,105,.35)",color:"#6ee7b7"}} onClick={()=>setRsDailyEmailModal(true)}>
                  🌅 Ver agenda del día
                </button>
              </div>
              <div className="sec-hdr" style={{marginBottom:8}}>📄 Agenda del Roadshow (English · formato LS)</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportRoadshowPDF} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")exportRoadshowPDF();}}>
                  <div className="ex-card-ico">📄</div>
                  <div className="ex-card-t">PDF — Agenda completa</div>
                  <div className="ex-card-s">Formato LS, English. Para compartir con el cliente.</div>
                </div>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportRoadshowSummary} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")exportRoadshowSummary();}}>
                  <div className="ex-card-ico">📊</div>
                  <div className="ex-card-t">Resumen ejecutivo</div>
                  <div className="ex-card-s">KPIs, cobertura por sector y agenda del viaje.</div>
                </div>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportPostRoadshowReport} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")exportPostRoadshowReport();}} style={{borderColor:"#16a34a30",background:"linear-gradient(135deg,#f8fff8,#f0fdf4)"}}>
                  <div className="ex-card-ico">🔬</div>
                  <div className="ex-card-t">Reporte con feedback</div>
                  <div className="ex-card-s">Interés por empresa, topics, next steps, follow-ups pendientes. Para uso interno.</div>
                  <div style={{display:"flex",gap:6,marginTop:6}} onClick={e=>e.stopPropagation()}>
                    <button className="btn bo bs" style={{fontSize:8}} onClick={exportPostRoadshowReport}>🖨 Imprimir/PDF</button>
                    <button className="btn bo bs" style={{fontSize:8}} onClick={()=>{
                      // Generate same HTML and download as .doc
                      const {_exportPostRoadshowReport}=require("../../src/utils/exporters.js");
                      // Simpler: call openPrint but with downloadBlob instead
                      const fn=`PostRoadshow_${(roadshow.trip.fund||"Report").replace(/[^a-zA-Z0-9]/g,"_")}.doc`;
                      // We need the HTML - regenerate it
                      import("../../src/utils/exporters.js").then(mod=>{
                        // Use a trick: temporarily override openPrint to capture HTML
                        mod._exportPostRoadshowReport({roadshow,openPrint:html=>{
                          const blob=new Blob([html],{type:"application/msword"});
                          const url=URL.createObjectURL(blob);const a=document.createElement("a");
                          a.href=url;a.download=fn;document.body.appendChild(a);a.click();document.body.removeChild(a);
                          setTimeout(()=>URL.revokeObjectURL(url),5000);
                          toastOk("✅ Word descargado");
                        }});
                      });
                    }}>📄 Word</button>
                  </div>
                </div>
                <div className="ex-card" role="button" tabIndex={0} onClick={()=>exportDriverItinerary(null)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")exportDriverItinerary(null);}}>
                  <div className="ex-card-ico">🚗</div>
                  <div className="ex-card-t">Itinerario del chofer</div>
                  <div className="ex-card-s">Ruta día a día con horarios de salida, traslados y contactos.</div>
                </div>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportRoadshowWord} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")exportRoadshowWord();}}>
                  <div className="ex-card-ico">📝</div>
                  <div className="ex-card-t">Word — Agenda completa</div>
                  <div className="ex-card-s">Documento .doc editable, mismo formato.</div>
                </div>
              </div>
              <div className="sec-hdr" style={{marginBottom:8}}>📅 Outlook / Calendario (.ICS)</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportRoadshowICS} onKeyDown={e=>{if(e.key==="Enter")exportRoadshowICS();}}>
                  <div className="ex-card-ico">📅</div>
                  <div className="ex-card-t">Exportar .ICS (Outlook)</div>
                  <div className="ex-card-s">Todas las reuniones confirmadas como invitaciones de calendario.</div>
                </div>
                <div className="ex-card" role="button" tabIndex={0}
                  onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept=".ics,.ical,text/calendar";inp.onchange=async e=>{const f=e.target.files[0];if(!f)return;const txt=await f.text();const evs=parseICS(txt);if(!evs.length){toast("No se encontraron eventos en el archivo .ics.");return;}setIcsImportModal({events:evs,selected:new Set(evs.map((_,i)=>i))});};inp.click();}}>
                  <div className="ex-card-ico">📥</div>
                  <div className="ex-card-t">Importar .ICS (Outlook → App)</div>
                  <div className="ex-card-s">Cargá un archivo .ics exportado de Outlook o Google Calendar para importar reuniones.</div>
                </div>
                <div className="ex-card" role="button" tabIndex={0} onClick={exportBookingPage} onKeyDown={e=>{if(e.key==="Enter")exportBookingPage();}}>
                  <div className="ex-card-ico">🔗</div>
                  <div className="ex-card-t">Página de reserva (HTML offline)</div>
                  <div className="ex-card-s">Descarga HTML estático — funciona sin conexión pero no sincroniza con la app.</div>
                </div>
                {publishBookingSlots&&<div className="ex-card" role="button" tabIndex={0} onClick={publishBookingSlots} onKeyDown={e=>{if(e.key==="Enter")publishBookingSlots();}} style={{borderColor:"#1e5ab033",background:"linear-gradient(135deg,#f8faff,#eef3ff)"}}>
                  <div className="ex-card-ico">🌐</div>
                  <div className="ex-card-t">Link de reserva online</div>
                  <div className="ex-card-s">Publica horarios en la nube. Las empresas reservan con un link y las reservas aparecen en la app.</div>
                </div>}
              </div>
              <div className="sec-hdr" style={{marginBottom:8}}>📋 Compartir disponibilidad (español)</div>
              <div className="card">
                <p style={{fontSize:12,color:"var(--dim)",marginBottom:10,lineHeight:1.6}}>Genera un resumen de los horarios libres para enviar a las empresas por WhatsApp o email.</p>
                <button className="btn bo bs" style={{gap:5}} onClick={()=>{
                  const busy=new Set(roadshow.meetings.map(m=>`${m.date}-${m.hour}`));
                  const workDays=tripDays.filter(d=>{const dow=new Date(d+"T12:00:00").getDay();return dow!==0&&dow!==6;});
                  const lines=workDays.map(date=>{
                    const d=new Date(date+"T12:00:00");
                    const ds=d.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"});
                    const fh=[9,10,11,12,14,15,16,17].filter(h=>!busy.has(`${date}-${h}`));
                    if(!fh.length) return null;
                    return `${ds.charAt(0).toUpperCase()+ds.slice(1)}:\n${fh.map(h=>`  • ${h}:00 – ${h+1}:00 hs`).join("\n")}`;
                  }).filter(Boolean);
                  const d1=roadshow.trip.arrivalDate?new Date(roadshow.trip.arrivalDate+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"long"}):"";
                  const d2=roadshow.trip.departureDate?new Date(roadshow.trip.departureDate+"T12:00:00").toLocaleDateString("es-AR",{day:"numeric",month:"long",year:"numeric"}):"";
                  const txt=`Horarios disponibles${roadshow.trip.clientName?" — "+roadshow.trip.clientName:""}\nBuenos Aires${d1?" · "+d1+" – "+d2:""}\n\n${lines.join("\n\n")||"Sin horarios disponibles"}\n\nLugar: ${roadshow.trip.officeAddress||"Arenales 707, 6° Piso, CABA"} (o en la sede de la empresa, según preferencia).`;
                  navigator.clipboard.writeText(txt).then(()=>toastOk("✅ Horarios copiados al portapapeles.")).catch(()=>{const w=window.open("","_blank","width=580,height=480");w.document.write("<pre style='font:13px monospace;padding:20px;white-space:pre-wrap'>"+txt.replace(/</g,"&lt;")+"</pre>");w.document.close();});
                }}>📋 Copiar horarios disponibles</button>
              </div>
            </div>
          )}

          {/* Activity Log subtab */}
          {rsSubTab==="activitylog"&&(()=>{
            // Build unified activity feed from meeting changeLogs + explicit activityLog
            const fmtHH=h=>{const hh=Math.floor(h);const mm=Math.round((h-hh)*60);return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0");};
            const feed=[];
            // From meeting changeLogs
            (roadshow.meetings||[]).forEach(m=>{
              const co=m.type==="company"?rsCoById.get(m.companyId):null;
              const name=co?.name||(m.lsType||m.title||"Reunión");
              (m.changeLog||[]).forEach(cl=>{
                const icons={moved:"🔄",status:"📌",location:"📍",hour:"⏰",date:"📅",created:"➕"};
                const icon=icons[cl.field]||"✏️";
                let desc=`${icon} **${name}**`;
                if(cl.field==="moved") desc+=` movida de ${cl.from} a ${cl.to}`;
                else if(cl.field==="status") desc+=` estado: ${cl.from} → ${cl.to}`;
                else desc+=` ${cl.field} actualizado`;
                feed.push({ts:cl.at,desc,type:"meeting"});
              });
              // Meeting creation (use icsVersion=1 + no changeLog as proxy)
              if((!m.changeLog||!m.changeLog.length)&&m.id){
                feed.push({ts:m.id.includes("-")?new Date(parseInt(m.id.split("-")[1])||0).toISOString():"",desc:`➕ **${name}** agregada · ${m.date} ${fmtHH(m.hour)}`,type:"meeting"});
              }
            });
            // From explicit activityLog
            (currentEvent?.activityLog||[]).forEach(entry=>{
              feed.push({ts:entry.ts,desc:`${entry.action}${entry.detail?" — "+entry.detail:""}`,user:entry.user,type:"manual"});
            });
            // Sort by timestamp desc
            feed.sort((a,b)=>(b.ts||"").localeCompare(a.ts||""));
            const grouped={};
            feed.forEach(f=>{const day=f.ts?f.ts.slice(0,10):"unknown";if(!grouped[day])grouped[day]=[];grouped[day].push(f);});
            const days=Object.keys(grouped).sort().reverse();
            return(
              <div>
                <h2 className="pg-h" style={{fontSize:16,marginBottom:4}}>🕐 Activity Feed</h2>
                <p className="pg-s" style={{marginBottom:14}}>Timeline de cambios en este roadshow.</p>
                {feed.length===0?(
                  <div className="card"><EmptyState icon="timeline" title="Sin actividad aún" subtitle="Creá o modificá reuniones para ver el historial de cambios acá."/></div>
                ):(
                  <div>
                    {days.map(day=>(
                      <div key={day} style={{marginBottom:16}}>
                        <div style={{fontSize:10,fontFamily:"IBM Plex Mono,monospace",color:"var(--dim)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8,paddingBottom:4,borderBottom:"1px solid rgba(30,90,176,.08)"}}>
                          {day==="unknown"?"Sin fecha":new Date(day+"T12:00:00").toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"long"})}
                        </div>
                        {grouped[day].map((f,i)=>{
                          const time=f.ts?new Date(f.ts).toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"}):"";
                          return(
                            <div key={i} style={{display:"flex",gap:10,marginBottom:6,paddingLeft:4}}>
                              <div style={{width:2,background:f.type==="meeting"?"#1e5ab0":"#23a29e",borderRadius:2,flexShrink:0}}/>
                              <div style={{flex:1}}>
                                <div style={{fontSize:12,color:"var(--cream)",lineHeight:1.5}} dangerouslySetInnerHTML={{__html:f.desc.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")}}/>
                                <div style={{fontSize:9,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace",marginTop:1}}>{time}{f.user?" · "+f.user:""}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Modals */}
          {rsMtgModal&&<RoadshowMeetingModal
            mode={rsMtgModal.meeting?"edit":"add"}
            date={rsMtgModal.date} hour={rsMtgModal.hour}
            meeting={rsMtgModal.meeting}
            companies={roadshow.companies}
            trip={roadshow.trip}
            onSave={saveMtg}
            onDelete={()=>delMtg(rsMtgModal.meeting?.id)}
            onDuplicate={()=>{
              const orig=rsMtgModal.meeting;
              if(!orig) return;
              // Find next free slot (same day, next hour block)
              const busySet=new Set((roadshow.meetings||[]).map(m=>`${m.date}-${m.hour}`));
              const HOURS=ROADSHOW_HOURS;
              let newH=orig.hour+1;
              let newD=orig.date;
              // try to find a free slot on the same day
              const dayHours=HOURS.filter(h=>h>orig.hour);
              const freeH=dayHours.find(h=>!busySet.has(`${newD}-${h}`));
              if(freeH) newH=freeH;
              const cloned={...orig,id:`rs-${Date.now()}`,hour:newH,
                status:"tentative",
                changeLog:[{at:new Date().toISOString(),field:"created",from:"clone",to:`clone of ${orig.id}`}]};
              saveMtg(cloned);
              // Open the cloned meeting for editing
              setTimeout(()=>setRsMtgModal({date:newD,hour:newH,meeting:cloned}),80);
            }}
            onExportICS={exportRoadshowICS}
            onClose={()=>setRsMtgModal(null)}
          />}
          {rsEmailModal&&<RoadshowEmailModal
            company={rsEmailModal.company}
            emailData={rsEmailModal.emailData}
            onClose={()=>setRsEmailModal(null)}
          />}
          {/* ── ICS Import Modal ── */}
          {icsImportModal&&(
            <div className="overlay" onClick={e=>{if(e.target===e.currentTarget)setIcsImportModal(null);}}>
              <div className="modal" style={{maxWidth:560,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
                <div className="modal-hdr"><div className="modal-title">📥 Importar desde .ICS</div></div>
                <div className="modal-body" style={{flex:1,overflowY:"auto"}}>
                  <p style={{fontSize:12,color:"var(--dim)",marginBottom:14,lineHeight:1.6}}>
                    Se encontraron <strong style={{color:"var(--cream)"}}>{icsImportModal.events.length} evento(s)</strong>. Seleccioná cuáles importar como reuniones.
                  </p>
                  <div style={{display:"flex",gap:6,marginBottom:12}}>
                    <button className="btn bo bs" style={{fontSize:10}} onClick={()=>setIcsImportModal(prev=>({...prev,selected:new Set(prev.events.map((_,i)=>i))}))}>✓ Todos</button>
                    <button className="btn bo bs" style={{fontSize:10}} onClick={()=>setIcsImportModal(prev=>({...prev,selected:new Set()}))}>✗ Ninguno</button>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {icsImportModal.events.map((ev,i)=>{
                      const checked=icsImportModal.selected.has(i);
                      const exists=(roadshow.meetings||[]).some(m=>m.icsUid===ev.uid);
                      return(
                        <label key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 12px",background:checked?"rgba(30,90,176,.06)":"var(--ink3)",borderRadius:7,border:"1px solid",borderColor:checked?"rgba(30,90,176,.2)":"transparent",cursor:"pointer"}}>
                          <input type="checkbox" checked={checked} disabled={exists}
                            onChange={()=>setIcsImportModal(prev=>{const s=new Set(prev.selected);s.has(i)?s.delete(i):s.add(i);return{...prev,selected:s};})}
                            style={{marginTop:2,flexShrink:0}}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:12,fontWeight:600,color:"var(--cream)",marginBottom:2}}>{ev.title}</div>
                            <div style={{fontSize:10,color:"var(--dim)",fontFamily:"IBM Plex Mono,monospace"}}>{ev.date} · {ev.hour}:00 · {ev.duration} min</div>
                            {ev.locationCustom&&<div style={{fontSize:10,color:"var(--dim)",marginTop:2}}>📍 {ev.locationCustom}</div>}
                            {exists&&<div style={{fontSize:9,color:"var(--gold)",marginTop:2}}>⚠ Ya importado</div>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="modal-footer" style={{gap:7}}>
                  <button className="btn bo bs" onClick={()=>setIcsImportModal(null)}>Cancelar</button>
                  <button className="btn bg bs" disabled={!icsImportModal.selected.size}
                    onClick={()=>{
                      const toImport=[...icsImportModal.selected].map(i=>icsImportModal.events[i]);
                      const newMtgs=toImport.map(ev=>({
                        id:`ics-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
                        type:"internal",lsType:"Imported",
                        date:ev.date,hour:ev.hour,
                        duration:ev.duration,
                        location:"other",locationCustom:ev.locationCustom||"",
                        notes:ev.notes,title:ev.title,
                        status:"tentative",
                        icsUid:ev.uid,
                      }));
                      saveRoadshow({...roadshow,meetings:[...(roadshow.meetings||[]),...newMtgs]},
                        `Importó ${newMtgs.length} reunión(es) desde .ICS`);
                      setIcsImportModal(null);
                    }}>
                    📥 Importar {icsImportModal.selected.size} reunión(es)
                  </button>
                </div>
              </div>
            </div>
          )}

          {rsAgendaEmailModal&&<RoadshowAgendaEmailModal
            roadshow={roadshow}
            rsCos={roadshow.companies}
            tripDays={tripDays}
            lsContact={(config.contacts||[])[roadshow.trip.lsContactIdx||0]||{}}
            onClose={()=>setRsAgendaEmailModal(false)}
          />}
          {rsDailyEmailModal&&<DailyBriefingEmailModal
            roadshow={roadshow}
            rsCos={roadshow.companies}
            tripDays={tripDays}
            lsContact={(config.contacts||[])[roadshow.trip.lsContactIdx||0]||{}}
            onClose={()=>setRsDailyEmailModal(false)}
          />}
          {kioskMode&&<KioskModal
            roadshow={roadshow}
            tripDays={tripDays}
            rsCoById={rsCoById}
            kioskDate={rsDayFilter}
            kioskIdx={kioskIdx}
            setKioskIdx={setKioskIdx}
            kioskFb={kioskFb}
            setKioskFb={setKioskFb}
            kioskFbData={kioskFbData}
            setKioskFbData={setKioskFbData}
            onClose={()=>{setKioskMode(false);setKioskFb(false);}}
            onSaveMtg={saveMtg}
          />}

          </div>{/* end tab-enter */}

          {/* ── Library Picker Modal ──────────────────────────────── */}
          {libPicker&&(
            <div className="overlay" role="dialog" aria-modal="true" aria-label="Importar empresas de Librería" onClick={e=>{if(e.target===e.currentTarget)setLibPicker(false);}} onKeyDown={e=>{if(e.key==="Escape")setLibPicker(false);}}>
              <FocusTrap><div className="modal" style={{maxWidth:560,width:"95%",maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
                <div className="modal-hdr" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div className="modal-title">📚 Importar empresas de la Librería</div>
                  <div style={{fontSize:11,color:"var(--dim)"}}>{libSelected.size} seleccionadas</div>
                </div>
                <div style={{padding:"8px 20px",borderBottom:"1px solid rgba(30,90,176,.08)"}}>
                  <input className="inp" placeholder="Buscar empresa..." value={libSearch} onChange={e=>setLibSearch(e.target.value)} autoFocus style={{fontSize:13}}/>
                </div>
                <div className="modal-body" style={{overflowY:"auto",flex:1,padding:"10px 20px"}}>
                  <div style={{display:"flex",gap:6,marginBottom:10}}>
                    <button className="btn bo bs" style={{fontSize:9}} onClick={()=>setLibSelected(new Set((globalDB.companies||[]).map(c=>c.id)))}>Todas</button>
                    <button className="btn bo bs" style={{fontSize:9}} onClick={()=>setLibSelected(new Set())}>Ninguna</button>
                    <button className="btn bo bs" style={{fontSize:9}} onClick={()=>{const existing=new Set((roadshow.companies||[]).map(c=>c.name.toLowerCase()));setLibSelected(new Set((globalDB.companies||[]).filter(c=>!existing.has(c.name.toLowerCase())).map(c=>c.id)));}}>Solo nuevas</button>
                  </div>
                  {(globalDB.companies||[]).filter(c=>{if(!libSearch)return true;const q=libSearch.toLowerCase();return c.name.toLowerCase().includes(q)||c.ticker?.toLowerCase().includes(q)||c.sector?.toLowerCase().includes(q);}).map(c=>{
                    const existsInRs=(roadshow.companies||[]).some(rc=>rc.name.toLowerCase()===c.name.toLowerCase());
                    return(
                      <label key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderBottom:"1px solid #f3f5f9",cursor:"pointer",background:libSelected.has(c.id)?"rgba(30,90,176,.04)":"transparent",borderRadius:6,marginBottom:2}}>
                        <input type="checkbox" checked={libSelected.has(c.id)} onChange={()=>{const s=new Set(libSelected);s.has(c.id)?s.delete(c.id):s.add(c.id);setLibSelected(s);}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontWeight:700,color:"#000039",fontSize:12}}>{c.name}</span>
                            {c.ticker&&<span style={{fontSize:9,color:"#1e5ab0",fontFamily:"IBM Plex Mono,monospace",background:"rgba(30,90,176,.08)",padding:"1px 5px",borderRadius:3}}>{c.ticker}</span>}
                            {c.sector&&<span style={{fontSize:9,color:"var(--dim)"}}>{c.sector}</span>}
                            {existsInRs&&<span style={{fontSize:8,color:"#166534",background:"#dcfce7",padding:"1px 5px",borderRadius:3}}>ya en roadshow</span>}
                          </div>
                          {(c.contacts||[]).length>0&&<div style={{fontSize:10,color:"var(--dim)",marginTop:2}}>{c.contacts.map(ct=>ct.name).filter(Boolean).join(", ")||"Sin contactos"} · {c.hqAddress||"Sin dirección"}</div>}
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="modal-footer" style={{gap:8}}>
                  <button className="btn bo bs" onClick={()=>setLibPicker(false)}>Cancelar</button>
                  <button className="btn bg bs" disabled={!libSelected.size} onClick={()=>{
                    const mapContact=ct=>({id:ct.id||`rep_${Date.now()}_${Math.random().toString(36).slice(2)}`,name:ct.name||"",title:ct.title||ct.role||"",email:ct.email||"",phone:ct.phone||""});
                    const existingNames=new Set((roadshow.companies||[]).map(c=>c.name.toLowerCase()));
                    const dbCos=(globalDB.companies||[]).filter(c=>libSelected.has(c.id));
                    let added=0,updated=0;
                    const updatedCos=(roadshow.companies||[]).map(rc=>{
                      const lib=dbCos.find(c=>c.name.toLowerCase()===rc.name.toLowerCase());
                      if(!lib)return rc;
                      updated++;
                      return{...rc,hqAddress:lib.hqAddress||rc.hqAddress,contacts:(lib.contacts||[]).length?(lib.contacts||[]).map(mapContact):(rc.contacts||[]),ticker:lib.ticker||rc.ticker,sector:lib.sector||rc.sector};
                    });
                    const toAdd=dbCos.filter(c=>!existingNames.has(c.name.toLowerCase())).map(c=>{added++;return{id:`rc_${Date.now()}_${Math.random().toString(36).slice(2)}`,name:c.name,ticker:c.ticker||"",sector:c.sector||"Custom",location:"ls_office",contacts:(c.contacts||[]).map(mapContact),hqAddress:c.hqAddress||"",notes:c.notes||"",active:true};});
                    saveRoadshow({...roadshow,companies:[...updatedCos,...toAdd]});
                    const parts=[];if(added)parts.push(`${added} nuevas`);if(updated)parts.push(`${updated} actualizadas`);
                    toastOk("✅ "+parts.join(" · "));setLibPicker(false);
                  }}>📚 Importar {libSelected.size} empresa{libSelected.size!==1?"s":""}</button>
                </div>
              </div></FocusTrap>
            </div>
          )}

          {/* ── WhatsApp Bulk Modal ─────────────────────────────── */}
          {waBulkModal&&(
            <div className="overlay" role="dialog" aria-modal="true" aria-label="WhatsApp Bulk" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center"}}
              onClick={e=>{if(e.target===e.currentTarget)setWaBulkModal(null);}}
              onKeyDown={e=>{if(e.key==="Escape")setWaBulkModal(null);}}>
              <FocusTrap><div className="modal" style={{maxWidth:560,width:"95%",maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
                <div className="modal-hdr">
                  <div className="modal-title">💬 WhatsApp Bulk — {waBulkModal.dateLabel}</div>
                  <button className="modal-x" onClick={()=>setWaBulkModal(null)}>✕</button>
                </div>
                <div className="modal-body" style={{overflowY:"auto",flex:1}}>
                  {waBulkModal.empty&&<p style={{fontSize:12,color:"#b91c1c",marginBottom:12,textAlign:"center",padding:"20px 0"}}>
                    No hay contactos con teléfono cargado para este día.<br/><span style={{fontSize:10,color:"var(--dim)"}}>Agregá números de teléfono en la pestaña Empresas.</span>
                  </p>}
                  {!waBulkModal.empty&&<p style={{fontSize:11,color:"var(--dim)",marginBottom:12}}>
                    {waBulkModal.items.length} mensaje{waBulkModal.items.length!==1?"s":""} · Hacé click en cada link para abrir WhatsApp con el mensaje pre-cargado.
                  </p>}
                  {waBulkModal.items.map((item,i)=>(
                    <div key={i} style={{marginBottom:12,background:"var(--ink3,#f9fafb)",borderRadius:8,border:"1px solid rgba(0,0,57,.06)",overflow:"hidden"}}>
                      <div style={{padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid rgba(0,0,57,.06)"}}>
                        <div>
                          <div style={{fontSize:12,fontWeight:700,color:"#000039"}}>{item.contact.name}</div>
                          <div style={{fontSize:10,color:"#6b7280"}}>{item.company.name}{item.contact.title?" · "+item.contact.title:""}</div>
                        </div>
                        <a href={item.waUrl} target="_blank" rel="noopener noreferrer"
                          style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 14px",borderRadius:8,background:"#25d366",color:"#fff",fontSize:11,fontWeight:600,textDecoration:"none",whiteSpace:"nowrap"}}
                          >💬 Enviar</a>
                      </div>
                      <pre style={{fontFamily:"inherit",fontSize:10,whiteSpace:"pre-wrap",margin:0,padding:"10px 14px",color:"#374151",lineHeight:1.6}}>{item.message}</pre>
                    </div>
                  ))}
                </div>
                <div className="modal-footer" style={{gap:7,borderTop:"1px solid rgba(0,0,57,.08)",padding:"10px 18px"}}>
                  {waBulkModal.items.length>0&&<button className="btn bo bs" style={{fontSize:10}} onClick={()=>{
                    const all=waBulkModal.items.map(it=>`▸ ${it.company.name} — ${it.contact.name}\n${it.message}`).join("\n\n─────────────────\n\n");
                    navigator.clipboard.writeText(all);
                  }}>📋 Copiar todos</button>}
                  <button className="btn bo bs" style={{fontSize:10}} onClick={()=>setWaBulkModal(null)}>Cerrar</button>
                </div>
              </div></FocusTrap>
            </div>
          )}
        </div>
        );
}
