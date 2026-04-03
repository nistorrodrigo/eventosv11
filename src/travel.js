// ── travel.js — geocoding and travel routing utilities ──

export function getMeetingAddress(m, co, officeAddress){
  if(m.fullAddress) return m.fullAddress;
  if(m.location==="ls_office") return officeAddress||"Arenales 707, 6° Piso, CABA, Argentina";
  if(m.location==="hq") return co?.hqAddress||co?.locationCustom||co?.name+", Buenos Aires, Argentina";
  return m.locationCustom||"Buenos Aires, Argentina";
}

// Free travel time: Nominatim geocoding + OSRM routing — no API key needed
// ── Free routing: Nominatim geocoding + OSRM ──────────────────────────────
// Strip BA neighborhood names from addresses for clean export display
// "Maipú 1, Puerto Madero, CABA" → "Maipú 1, CABA"
export function stripNeighborhood(addr){
  if(!addr) return addr;
  const HOODS=["Puerto Madero","Catalinas","Núñez","Retiro","San Nicolás","Microcentro","Palermo","Recoleta","Belgrano","Almagro","Caballito","Villa Crespo","Colegiales","Saavedra","Villa Urquiza","Villa del Parque","Flores","San Telmo","La Boca","Constitución","Barracas","Villa Lugano","Liniers","Monserrat","San Cristóbal","Parque Patricios","Boedo","Chacarita","Devoto","Mataderos","Villa Pueyrredón","Versalles"];
  let cleaned=addr;
  for(const h of HOODS){
    // Remove ", Neighborhood" or ", Neighborhood," patterns
    cleaned=cleaned.replace(new RegExp(",\\s*"+h.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\s*(?=,|$)","gi"),",").replace(/,\s*,/g,",").trim();
  }
  // Clean trailing/leading commas
  return cleaned.replace(/^,\s*|,\s*$/g,"").replace(/,\s*,/g,",").trim();
}
export function cleanAddr(addr){
  // Strip floor/piso/level info that confuses Nominatim ("Piso 26", "Planta 3", "Piso 6°")
  // Remove floor info: 'Piso 26', '6° Piso', 'Planta 3', 'Floor 2', 'PB', 'Oficina'
  return addr.replace(/,?\s*(\d+°?\s*)?(Piso|Planta|Floor|Level|Oficina|PB)(\s*\d+°?)?/gi,'').replace(/,?\s*\d+°(\s|,|$)/g,'$1').replace(/\s{2,}/g,' ').replace(/,\s*,/g,',').trim();
}
// geocodeAll: geocodes an array of unique addresses, 1 req/sec to respect Nominatim
export async function geocodeAll(addresses){
  const unique=[...new Set(addresses)];
  const coords={};
  for(const addr of unique){
    try{
      const cleaned=cleanAddr(addr);
      const q=encodeURIComponent(cleaned+", Buenos Aires, Argentina");
      const r=await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
        {headers:{"Accept-Language":"es","User-Agent":"LS-EventManager/1.0 latinse"}});
      if(r.ok){
        const d=await r.json();
        if(d.length) coords[addr]={lat:parseFloat(d[0].lat),lon:parseFloat(d[0].lon)};
      }
    }catch(e){/* skip */}
    await new Promise(res=>setTimeout(res,1100)); // 1 req/sec Nominatim limit
  }
  return coords;
}
export async function osrmRoute(o,d){
  try{
    const url=`https://router.project-osrm.org/route/v1/driving/${o.lon},${o.lat};${d.lon},${d.lat}?overview=false`;
    const ctrl=new AbortController();
    setTimeout(()=>ctrl.abort(),8000);
    const r=await fetch(url,{signal:ctrl.signal});
    if(!r.ok) return null;
    const j=await r.json();
    if(j.code!=="Ok"||!j.routes?.length) return null;
    const sec=Math.round(j.routes[0].duration);
    const km=Math.round(j.routes[0].distance/1000*10)/10;
    const min=Math.round(sec/60);
    return{durationText:min<60?`${min} min`:`${Math.floor(min/60)}h ${min%60}min`,durationSec:sec,distanceText:`${km} km`};
  }catch(e){return null;}
}

export function openGoogleMapsRoute(stops){
  if(!stops.length) return;
  const origin=encodeURIComponent(stops[0]);
  const dest=encodeURIComponent(stops[stops.length-1]);
  const waypoints=stops.slice(1,-1).map(s=>encodeURIComponent(s)).join("|");
  const url=`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}${waypoints?`&waypoints=${waypoints}`:""}&travelmode=driving`;
  window.open(url,"_blank");
}

export function openGoogleMapsDirections(from, to){
  const url=`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&travelmode=driving`;
  window.open(url,"_blank");
}

// Check if two consecutive meetings have a potential conflict (not enough travel time)
export function checkTravelConflict(m1, m2, travelSec, durationMin){
  const gap=(m2.hour-m1.hour)*60-(durationMin||60);
  if(travelSec==null) return gap<15?{warning:true,gapMin:gap}:null;
  const travelMin=Math.ceil(travelSec/60);
  return gap<travelMin?{conflict:true,gapMin:gap,travelMin}:gap<travelMin+10?{warning:true,gapMin:gap,travelMin}:null;
}

