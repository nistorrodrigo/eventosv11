// ── SettingsModal.jsx — per-user settings (lives in AuthContext / ls_resend_keys) ──
// Renders modal for personal-scope settings that should NOT live inside an event's
// JSON blob (because events get shared with collaborators). Today: Resend API key.
// Future: notification prefs, default timezone, signature, etc.
import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext.tsx";
import { toastOk, toastErr } from "./Toast.tsx";
import { FocusTrap } from "./FocusTrap.tsx";

export function SettingsModal({ onClose }) {
  const { authUser, resendKey, resendKeyLoaded, saveResendKey } = useAuth();
  const [keyInput, setKeyInput] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync local input with the loaded value
  useEffect(() => { if (resendKeyLoaded) setKeyInput(resendKey || ""); }, [resendKey, resendKeyLoaded]);

  async function save() {
    setSaving(true);
    const r = await saveResendKey(keyInput);
    setSaving(false);
    if (r?.error) {
      toastErr("Error guardando la API key — " + (r.error.message || ""));
      return;
    }
    setDirty(false);
    toastOk(keyInput.trim() ? "✅ Resend API key guardada" : "🗑 Resend API key eliminada");
  }

  return (
    <FocusTrap>
      <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={e => { if (e.key === "Escape") onClose(); }}>
        <div className="modal" style={{ maxWidth: 560 }}>
          <div className="modal-hdr">
            <div className="modal-title">⚙ Configuración personal</div>
          </div>
          <div className="modal-body">
            {/* User info */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, padding: "10px 12px", background: "var(--ink3)", borderRadius: 7 }}>
              <span style={{ fontSize: 20 }}>👤</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: "var(--cream)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{authUser?.email || "—"}</div>
                <div style={{ fontSize: 9, color: "var(--dim)", fontFamily: "IBM Plex Mono,monospace" }}>{authUser?.id?.slice(0, 8)}…</div>
              </div>
            </div>

            {/* Resend API Key */}
            <div style={{ marginBottom: 18, padding: "12px 14px", background: "rgba(30,90,176,.04)", border: "1px solid rgba(30,90,176,.15)", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 14 }}>✉️</span>
                <strong style={{ fontSize: 12, color: "var(--cream)" }}>Resend API Key</strong>
                <span style={{ fontSize: 9, color: "var(--gold)", fontWeight: 400 }}>personal · no se comparte con colaboradores</span>
              </div>
              <input
                className="inp"
                style={{ fontFamily: "IBM Plex Mono,monospace", fontSize: 11, marginBottom: 6 }}
                type="password"
                value={keyInput}
                disabled={!resendKeyLoaded}
                onChange={e => { setKeyInput(e.target.value); setDirty(true); }}
                placeholder={resendKeyLoaded ? "re_xxxxxxxxxxxxxxxxxxxx" : "Cargando..."}
              />
              <div style={{ fontSize: 10, color: "var(--dim)", lineHeight: 1.5 }}>
                Sin key configurada, los emails se copian al portapapeles. Con key, se mandan directo desde la app vía <a href="https://resend.com" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>Resend</a>.{" "}
                <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>Obtener key →</a>
              </div>
              {dirty && (
                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <button className="btn bo bs" style={{ fontSize: 10 }} onClick={() => { setKeyInput(resendKey || ""); setDirty(false); }} disabled={saving}>Descartar</button>
                  <button className="btn bg bs" style={{ fontSize: 10 }} onClick={save} disabled={saving}>{saving ? "Guardando…" : "💾 Guardar"}</button>
                </div>
              )}
            </div>

            <div style={{ fontSize: 10, color: "var(--dim)", textAlign: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(30,90,176,.08)" }}>
              Estas opciones aplican solo a <strong>tu usuario</strong>, no a los roadshows compartidos.
            </div>
          </div>
          <div className="modal-footer" style={{ gap: 6 }}>
            <button className="btn bo bs" onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
