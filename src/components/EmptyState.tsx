// ── EmptyState.jsx — Illustrated empty states ────────────────────

const ILLUSTRATIONS = {
  calendar: (
    <svg viewBox="0 0 120 100" fill="none" style={{width:120,height:100}}>
      <rect x="20" y="15" width="80" height="70" rx="8" fill="#e8edf5" stroke="#c7d4e8" strokeWidth="1.5"/>
      <rect x="20" y="15" width="80" height="18" rx="8" fill="#1e5ab0" opacity=".12"/>
      <rect x="20" y="33" width="80" height="0.5" fill="#c7d4e8"/>
      {[0,1,2].map(r=>[0,1,2,3].map(c=>(
        <rect key={r+"-"+c} x={28+c*19} y={38+r*14} width={14} height={9} rx={2} fill={r===1&&c===2?"#1e5ab0":"#f0f3f8"} opacity={r===1&&c===2?.3:.6}/>
      )))}
      <circle cx="90" cy="72" r="14" fill="#1e5ab0" opacity=".1"/><text x="90" y="77" textAnchor="middle" fontSize="14" fill="#1e5ab0" fontWeight="700">+</text>
    </svg>
  ),
  money: (
    <svg viewBox="0 0 120 100" fill="none" style={{width:120,height:100}}>
      <rect x="15" y="25" width="90" height="50" rx="10" fill="#e8edf5" stroke="#c7d4e8" strokeWidth="1.5"/>
      <circle cx="60" cy="50" r="15" fill="#1e5ab0" opacity=".1" stroke="#1e5ab0" strokeWidth="1" opacity=".2"/>
      <text x="60" y="55" textAnchor="middle" fontSize="16" fill="#1e5ab0" fontWeight="700" opacity=".4">$</text>
      <rect x="25" y="35" width="8" height="8" rx="4" fill="#c7d4e8"/><rect x="87" y="57" width="8" height="8" rx="4" fill="#c7d4e8"/>
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 120 100" fill="none" style={{width:120,height:100}}>
      <path d="M25 45 L60 65 L95 45 L95 80 C95 83.3 92.3 86 89 86 H31 C27.7 86 25 83.3 25 80 Z" fill="#e8edf5" stroke="#c7d4e8" strokeWidth="1.5"/>
      <path d="M25 45 L60 25 L95 45" stroke="#c7d4e8" strokeWidth="1.5" fill="none"/>
      <circle cx="60" cy="52" r="8" fill="#1e5ab0" opacity=".1"/><text x="60" y="56" textAnchor="middle" fontSize="10" fill="#1e5ab0" opacity=".5">📬</text>
    </svg>
  ),
  timeline: (
    <svg viewBox="0 0 120 100" fill="none" style={{width:120,height:100}}>
      <line x1="35" y1="20" x2="35" y2="80" stroke="#c7d4e8" strokeWidth="2" strokeDasharray="4 4"/>
      {[0,1,2].map(i=>(
        <g key={i}>
          <circle cx="35" cy={30+i*20} r="5" fill={i===0?"#1e5ab0":"#e8edf5"} stroke="#c7d4e8" strokeWidth="1"/>
          <rect x="48" y={24+i*20} width={50-i*10} height="12" rx="4" fill="#f0f3f8" stroke="#e8edf5" strokeWidth="0.5"/>
        </g>
      ))}
    </svg>
  ),
  search: (
    <svg viewBox="0 0 120 100" fill="none" style={{width:120,height:100}}>
      <circle cx="52" cy="45" r="22" fill="#e8edf5" stroke="#c7d4e8" strokeWidth="1.5"/>
      <line x1="68" y1="61" x2="88" y2="81" stroke="#1e5ab0" strokeWidth="3" strokeLinecap="round" opacity=".3"/>
      <circle cx="52" cy="45" r="10" fill="#1e5ab0" opacity=".06"/>
    </svg>
  ),
  people: (
    <svg viewBox="0 0 120 100" fill="none" style={{width:120,height:100}}>
      <circle cx="45" cy="35" r="12" fill="#e8edf5" stroke="#c7d4e8" strokeWidth="1.5"/>
      <circle cx="75" cy="35" r="12" fill="#e8edf5" stroke="#c7d4e8" strokeWidth="1.5"/>
      <path d="M25 78 C25 62 37 55 45 55 C53 55 60 60 60 60 C60 60 67 55 75 55 C83 55 95 62 95 78" fill="#1e5ab0" opacity=".06" stroke="#c7d4e8" strokeWidth="1"/>
    </svg>
  ),
};

export function EmptyState({ icon = "calendar", title, subtitle, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{ILLUSTRATIONS[icon] || ILLUSTRATIONS.calendar}</div>
      <div className="empty-state-title">{title}</div>
      {subtitle && <div className="empty-state-sub">{subtitle}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
