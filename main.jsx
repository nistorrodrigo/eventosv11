import React, { useState, useEffect, lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { ToastProvider } from './src/components/Toast.jsx'
import { AuthProvider } from './src/contexts/AuthContext.jsx'
import App from './App.jsx'
import { initMonitoring } from './src/utils/monitoring.ts'
initMonitoring();
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
