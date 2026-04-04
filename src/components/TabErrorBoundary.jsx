// ── TabErrorBoundary.jsx — Catches errors per tab without crashing entire app ──
import React from "react";

export class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error(`[TabError] ${this.props.name || "Unknown tab"}:`, error.message, info.componentStack?.slice(0, 300));
  }
  render() {
    if (this.state.error) return (
      <div style={{
        padding: "40px 20px", textAlign: "center", fontFamily: "Calibri,Arial,sans-serif"
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#000039", marginBottom: 8 }}>
          Error en {this.props.name || "esta sección"}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", maxWidth: 400, margin: "0 auto 16px", lineHeight: 1.6 }}>
          {this.state.error.message}
        </div>
        <button
          onClick={() => this.setState({ error: null })}
          style={{
            padding: "8px 20px", background: "#1e5ab0", color: "#fff",
            border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: "IBM Plex Mono,monospace"
          }}>
          🔄 Reintentar
        </button>
      </div>
    );
    return this.props.children;
  }
}
