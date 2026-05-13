import React, { useState, useEffect, lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { ToastProvider } from './src/components/Toast.tsx'
import { AuthProvider } from './src/contexts/AuthContext.tsx'
import App from './App.jsx'
import { initMonitoring } from './src/utils/monitoring.ts'
initMonitoring();

// ── Stale-chunk auto-recovery ───────────────────────────────────────
// When a new deploy lands while the user has the old index.html cached,
// dynamic imports (lazy tabs) try to fetch chunk hashes that no longer
// exist on the CDN and throw "Failed to fetch dynamically imported
// module". Vite emits a `vite:preloadError` event for these — catch it
// and force a reload.
//
// Loop-prevention: stamp `ls_chunk_reload` with a timestamp. If we see
// it again within 30s we assume the underlying problem is NOT a stale
// chunk (CSP block, network down, real bug) and skip the reload —
// otherwise the user would be in a tight infinite reload loop. After
// 30s the flag is treated as expired, so a legitimate stale chunk
// hours/days later still triggers a reload.
if (typeof window !== 'undefined') {
  const FLAG = 'ls_chunk_reload';
  const COOLDOWN_MS = 30000;
  let reloaded = false;
  const reloadOnce = (reason) => {
    if (reloaded) return;
    const prev = parseInt(sessionStorage.getItem(FLAG) || '0', 10);
    if (prev && Date.now() - prev < COOLDOWN_MS) {
      console.warn('[LS EventManager] Stale-chunk reload suppressed (recent reload). Reason:', reason);
      return;
    }
    reloaded = true;
    console.warn('[LS EventManager] Stale chunk detected, reloading:', reason);
    sessionStorage.setItem(FLAG, String(Date.now()));
    window.location.reload();
  };
  window.addEventListener('vite:preloadError', (e) => reloadOnce(e?.payload?.message || 'preload'));
  window.addEventListener('error', (e) => {
    if (e?.message && /dynamically imported module|Importing a module script failed/i.test(e.message)) {
      reloadOnce(e.message);
    }
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e?.reason?.message || '';
    if (/dynamically imported module|Importing a module script failed/i.test(msg)) {
      reloadOnce(msg);
    }
  });
  // Clean up the flag aggressively once the app actually boots. We use both
  // DOMContentLoaded and load — the earlier one fires even if a later resource
  // is still loading, preventing the flag from getting stuck if `load` never
  // fires (e.g. the ErrorBoundary catches before then).
  const clearFlag = () => sessionStorage.removeItem(FLAG);
  window.addEventListener('DOMContentLoaded', () => setTimeout(clearFlag, 2000));
  window.addEventListener('load', () => setTimeout(clearFlag, 2000));
}

const BookingPage = lazy(() => import('./src/components/BookingPage.jsx'))

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    // Log for debugging — remove if not needed
    console.error('[LS EventManager] Crash:', error.message, '\n', info.componentStack?.slice(0,400));
  }
  render() {
    if (this.state.error) return (
      <div style={{
        minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
        background:'#0d0e1a', flexDirection:'column', gap:16, padding:20, fontFamily:'Calibri,Arial,sans-serif'
      }}>
        <div style={{fontSize:32}}>⚠️</div>
        <div style={{color:'#e8eaf0', fontSize:18, fontWeight:700}}>Algo salió mal</div>
        <div style={{color:'#7a8fa8', fontSize:13, textAlign:'center', maxWidth:400, lineHeight:1.6}}>
          {this.state.error.message}
        </div>
        <button
          onClick={()=>{ localStorage.clear(); window.location.reload(); }}
          style={{marginTop:8, padding:'10px 24px', background:'#1e5ab0', color:'#fff',
            border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:'pointer'}}>
          🔄 Reiniciar app
        </button>
        <div style={{color:'#3a4a6a', fontSize:11, fontFamily:'IBM Plex Mono,monospace'}}>
          v{new Date().getFullYear()} · Latin Securities
        </div>
      </div>
    );
    return this.props.children;
  }
}

function Root(){
  const [hash,setHash]=useState(window.location.hash);
  useEffect(()=>{const h=()=>setHash(window.location.hash);window.addEventListener("hashchange",h);return()=>window.removeEventListener("hashchange",h);},[]);
  const bookMatch=hash.match(/^#\/book\/(.+)$/);
  if(bookMatch) return <Suspense fallback={<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f0f4f8",fontFamily:"Calibri",color:"#6b7280"}}>Cargando...</div>}><BookingPage eventId={decodeURIComponent(bookMatch[1])}/></Suspense>;
  return <App/>;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
