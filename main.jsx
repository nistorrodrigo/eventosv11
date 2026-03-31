import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('APP CRASH:', error, info); }
  render() {
    if (this.state.error) return (
      <div style={{padding:20,background:'#1a0a0a',color:'#ff6b6b',fontFamily:'monospace',minHeight:'100vh'}}>
        <h2>🔴 App Crash</h2>
        <pre style={{whiteSpace:'pre-wrap',fontSize:12}}>{this.state.error?.message}</pre>
        <pre style={{whiteSpace:'pre-wrap',fontSize:10,color:'#ff9999'}}>{this.state.error?.stack}</pre>
      </div>
    );
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
