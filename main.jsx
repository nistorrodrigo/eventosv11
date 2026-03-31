import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
