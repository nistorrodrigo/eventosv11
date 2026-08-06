// ── WeekCalendar.jsx — Weekly calendar grid (Google Calendar style) ──
import { RS_CLR } from "../roadshow.jsx";

const HOURS = [8,9,10,11,12,13,14,15,16,17,18];
const HOUR_H = 52; // px per hour row
const fmtH = h => { const hh=Math.floor(h); const mm=Math.round((h-hh)*60); return String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0"); };

export function WeekCalendar({ tripDays, meetings, companies, meetingDuration, onClickMeeting, onClickSlot, rsCoById }) {
  const dur = meetingDuration || 60;
  const workDays = tripDays.filter(d => { const dow = new Date(d+"T12:00:00").getDay(); return dow !== 0 && dow !== 6; });
  const DN = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

  // Column layout for overlapping meetings (Google Calendar style): meetings in
  // the same overlap cluster split the day column side-by-side instead of
  // stacking on top of each other (which hid all but the last one).
  const layout = new Map(); // meeting id → { col, cols }
  workDays.forEach(date => {
    const ms = (meetings||[])
      .filter(m => m.date === date && m.status !== "cancelled")
      .sort((a,b) => a.hour - b.hour || (b.duration||dur) - (a.duration||dur));
    let cluster = [];            // [{ m, col }] of the current overlap cluster
    let colEnds = [];            // per-column end hour within the cluster
    let clusterEnd = -Infinity;  // latest end hour seen in the cluster
    const flush = () => {
      if (!cluster.length) return;
      const cols = Math.max(...cluster.map(c => c.col)) + 1;
      cluster.forEach(c => layout.set(c.m.id, { col: c.col, cols }));
      cluster = []; colEnds = [];
    };
    ms.forEach(m => {
      const start = m.hour, end = m.hour + (m.duration||dur)/60;
      if (start >= clusterEnd) flush();
      clusterEnd = cluster.length ? Math.max(clusterEnd, end) : end;
      let col = 0;
      while (col < colEnds.length && colEnds[col] > start) col++;
      colEnds[col] = end;
      cluster.push({ m, col });
    });
    flush();
  });

  return (
    <div style={{ overflowX:"auto", WebkitOverflowScrolling:"touch", borderRadius:10, border:"1px solid rgba(30,90,176,.1)", background:"#fff" }}>
      <div style={{ display:"grid", gridTemplateColumns:`56px repeat(${workDays.length}, 1fr)`, minWidth: workDays.length * 140 + 56 }}>
        {/* Header row */}
        <div style={{ background:"#f8fafc", borderBottom:"2px solid #e9eef5", padding:"8px 4px", position:"sticky", left:0, zIndex:2 }}/>
        {workDays.map(date => {
          const d = new Date(date+"T12:00:00");
          const isToday = date === new Date().toISOString().slice(0,10);
          const dayMtgs = (meetings||[]).filter(m => m.date === date && m.status !== "cancelled");
          return (
            <div key={date} style={{
              background: isToday ? "#eff6ff" : "#f8fafc",
              borderBottom: "2px solid #e9eef5", borderLeft: "1px solid #f0f3f8",
              padding: "6px 8px", textAlign: "center"
            }}>
              <div style={{ fontSize:9, fontFamily:"IBM Plex Mono,monospace", color: isToday ? "#1e5ab0" : "#9ca3af", letterSpacing:".06em" }}>{DN[d.getDay()]}</div>
              <div style={{ fontSize:18, fontWeight:700, color: isToday ? "#1e5ab0" : "#000039", fontFamily:"Playfair Display,serif" }}>{d.getDate()}</div>
              <div style={{ fontSize:8, color:"#9ca3af", fontFamily:"IBM Plex Mono,monospace" }}>{dayMtgs.length} mtg{dayMtgs.length!==1?"s":""}</div>
            </div>
          );
        })}

        {/* Hour rows */}
        {HOURS.map(hour => (
          <div key={hour} style={{ display:"contents" }}>
            {/* Time label */}
            <div style={{
              padding:"4px 6px", fontSize:10, fontFamily:"IBM Plex Mono,monospace", color:"#9ca3af",
              borderBottom:"1px solid #f3f5f9", textAlign:"right", position:"sticky", left:0, zIndex:1,
              background:"#fff", height:HOUR_H, display:"flex", alignItems:"flex-start", justifyContent:"flex-end"
            }}>
              {fmtH(hour)}
            </div>
            {/* Day cells */}
            {workDays.map(date => {
              const isToday = date === new Date().toISOString().slice(0,10);
              return (
                <div key={date} style={{
                  borderBottom:"1px solid #f3f5f9", borderLeft:"1px solid #f0f3f8",
                  height:HOUR_H, position:"relative", cursor:"pointer",
                  background: isToday ? "rgba(30,90,176,.015)" : "transparent"
                }}
                  onClick={() => onClickSlot && onClickSlot({ date, hour })}
                >
                  {/* Render meetings that START in this hour */}
                  {(meetings||[]).filter(m => m.date === date && m.status !== "cancelled" && Math.floor(m.hour) === hour).map(m => {
                    const co = m.type === "company" ? rsCoById?.get(m.companyId) : null;
                    const name = co ? co.name : (m.lsType || m.title || "Reunión");
                    const ticker = co?.ticker || "";
                    const clr = co ? (RS_CLR[co.sector] || "#666") : "#23a29e";
                    const topOffset = (m.hour - hour) * HOUR_H;
                    const heightPx = ((m.duration||dur) / 60) * HOUR_H - 2;
                    const isConf = m.status === "confirmed";
                    const L = layout.get(m.id) || { col: 0, cols: 1 };
                    return (
                      <div key={m.id} title={`${name} · ${fmtH(m.hour)} · Click para editar`}
                        onClick={e => { e.stopPropagation(); onClickMeeting && onClickMeeting(m); }}
                        style={{
                          position:"absolute", top:topOffset,
                          left:`calc(${(L.col/L.cols)*100}% + 2px)`, width:`calc(${100/L.cols}% - 4px)`,
                          height:heightPx,
                          background:`${clr}18`, borderLeft:`3px solid ${clr}`, borderRadius:4,
                          padding:"3px 6px", overflow:"hidden", cursor:"pointer", zIndex:1,
                          transition:"all .12s"
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background=`${clr}30`; }}
                        onMouseLeave={e => { e.currentTarget.style.background=`${clr}18`; }}
                      >
                        <div style={{ fontSize:9, fontWeight:700, color:clr, lineHeight:1.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                          {fmtH(m.hour)} {name}
                        </div>
                        {ticker && <div style={{ fontSize:7.5, color:"#9ca3af", fontFamily:"IBM Plex Mono,monospace" }}>{ticker}</div>}
                        <div style={{ fontSize:7, color: isConf ? "#166534" : "#b45309", marginTop:1 }}>
                          {isConf ? "✓" : "◌"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
