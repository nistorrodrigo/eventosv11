// ── CrmSyncModal.jsx — Subir los inversores del roadshow al CRM ─────
// El Event Manager y el CRM comparten el mismo Supabase (crm-intl-sales),
// así que esto escribe DIRECTO en las tablas del CRM: clients / contacts /
// interactions. Por cada fondo del viaje: se vincula a un cliente existente
// (o se crea uno nuevo), se suben los visitantes como contactos y se registra
// la participación como una interacción (channel "reunion", topic "Event") —
// con eso el evento aparece en la ficha del cliente y cuenta como last touch.
// El resultado se guarda en roadshow.crmSync[fundId] para que re-sincronizar
// ACTUALICE la misma interacción en vez de duplicarla.
import { useState, useEffect, useMemo } from "react";
import { supabase } from "../../supabase.js";
import { toastOk, toastErr } from "./Toast.tsx";
import { FocusTrap } from "./FocusTrap.tsx";
import { useEvent } from "../contexts/EventContext.tsx";
import { useAuth } from "../contexts/AuthContext.tsx";
import { getAllFunds, isMultiFund, fundLabel, meetingsForFund, fmtDateRange, todayLocal } from "../roadshow.jsx";

// Tipos de cliente que existen en el CRM (valores reales de la columna client_type)
const CRM_TYPES = [
  ["hedge_fund", "Hedge Fund"],
  ["asset_manager", "Asset Manager"],
  ["family_office", "Family Office"],
  ["private_bank", "Private Bank"],
  ["broker_dealer", "Broker Dealer"],
  ["bank", "Bank"],
  ["institucional", "Institucional"],
];

// Normalización para matchear nombres de fondo contra clientes del CRM:
// minúsculas, sin acentos, sin sufijos legales, solo alfanumérico.
const normName = s => (s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .replace(/\b(llc|lp|llp|ltd|inc|corp|plc|sa|srl|gmbh|co)\b/g, "")
  .replace(/\s+/g, " ").trim();

// Score 0..1 entre el nombre del fondo y un cliente del CRM (ya normalizados).
function matchScore(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (b.startsWith(a + " ") || a.startsWith(b + " ") || (" " + b + " ").includes(" " + a + " ")) return 0.9;
  if (b.includes(a) || a.includes(b)) return 0.8;
  const ta = new Set(a.split(" ")), tb = new Set(b.split(" "));
  let inter = 0; for (const t of ta) if (tb.has(t)) inter++;
  return (inter / Math.max(ta.size, tb.size)) * 0.75;
}

export function CrmSyncModal({ onClose }) {
  const { roadshow, saveRoadshow, currentEvent, rsCoById } = useEvent();
  const { authUser } = useAuth();
  const trip = roadshow.trip || {};
  const multiF = isMultiFund(trip);
  const evTitle = currentEvent?.title || trip.fund || trip.clientName || "Investor Trip";
  const dateRange = (trip.arrivalDate && trip.departureDate)
    ? fmtDateRange(trip.arrivalDate, trip.departureDate, { locale: "es-AR", short: true, withYear: true }) : "";

  // ── Clientes del CRM ─────────────────────────────────────────────
  const [clients, setClients] = useState(null);   // null = cargando
  const [loadErr, setLoadErr] = useState("");
  useEffect(() => {
    let dead = false;
    (async () => {
      const { data, error } = await supabase.from("clients")
        .select("id,name,status,client_type").order("name");
      if (dead) return;
      if (error) { setLoadErr(error.message); setClients([]); }
      else setClients(data || []);
    })();
    return () => { dead = true; };
  }, []);
  const clientsById = useMemo(() => new Map((clients || []).map(c => [c.id, c])), [clients]);

  // ── Filas: un fondo del viaje = una fila ─────────────────────────
  const activeMtgs = useMemo(() => (roadshow.meetings || []).filter(m => m.status !== "cancelled"), [roadshow.meetings]);
  const roster = useMemo(() => getAllFunds(trip).map(f => f.id), [trip]);
  const funds = useMemo(() => getAllFunds(trip).filter(f => fundLabel(f) !== "Fondo sin nombre"), [trip]);

  const baseRows = useMemo(() => {
    if (!clients) return [];
    const prevSync = roadshow.crmSync || {};
    return funds.map(f => {
      const label = fundLabel(f);
      const mtgs = multiF ? meetingsForFund(activeMtgs, f.id, roster) : activeMtgs;
      const coNames = [...new Set(mtgs.filter(m => m.type === "company").map(m => rsCoById.get(m.companyId)?.name).filter(Boolean))];
      const listed = coNames.slice(0, 10).join(", ") + (coNames.length > 10 ? ` +${coNames.length - 10} más` : "");
      const summary = `${evTitle}${dateRange ? ` (${dateRange})` : ""} — participó del evento · ${mtgs.length} reunion${mtgs.length !== 1 ? "es" : ""}${coNames.length ? `: ${listed}` : ""}`;
      const happenedAt = `${trip.arrivalDate || mtgs[0]?.date || todayLocal()}T12:00:00`;
      const n = normName(label);
      const sugs = clients
        .map(c => ({ c, score: matchScore(n, normName(c.name)) }))
        .filter(x => x.score >= 0.55)
        .sort((a, b) => b.score - a.score).slice(0, 5);
      const prev = prevSync[f.id];
      // Default: ya sincronizado → mismo cliente; match fuerte → vincular; sino crear
      let action = "create", clientId = "";
      if (prev?.clientId && clientsById.has(prev.clientId)) { action = "link"; clientId = prev.clientId; }
      else if (sugs[0] && sugs[0].score >= 0.75) { action = "link"; clientId = sugs[0].c.id; }
      return {
        fundId: f.id, label, visitors: (f.visitors || []).filter(v => v.name),
        mtgCount: mtgs.length, summary, happenedAt, sugs, prev,
        action, clientId, newType: "hedge_fund", newStatus: "prospecto",
      };
    });
  }, [clients, funds, activeMtgs, roster, multiF, rsCoById, evTitle, dateRange, trip.arrivalDate, roadshow.crmSync, clientsById]);

  // Ediciones del usuario por encima de los defaults
  const [edits, setEdits] = useState({});          // fundId -> {action, clientId, newType, newStatus}
  const rows = baseRows.map(r => ({ ...r, ...(edits[r.fundId] || {}) }));
  const setRow = (fundId, patch) => setEdits(p => ({ ...p, [fundId]: { ...(p[fundId] || {}), ...patch } }));

  // Opciones globales
  const [optInteraction, setOptInteraction] = useState(true);
  const [optContacts, setOptContacts] = useState(true);
  const [optWantsEvents, setOptWantsEvents] = useState(true);

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);          // fundId -> {ok, msg}
  const toSync = rows.filter(r => r.action !== "skip" && !(r.action === "link" && !r.clientId));
  // En un reintento solo se procesan las filas que fallaron — las que ya se
  // subieron OK no se tocan (evita crear el mismo cliente dos veces).
  const pending = toSync.filter(r => !done?.[r.fundId]?.ok);

  // ── Sync ─────────────────────────────────────────────────────────
  async function runSync() {
    if (busy || !pending.length) return;
    setBusy(true);
    const results = {};
    const crmSync = { ...(roadshow.crmSync || {}) };
    for (const row of pending) {
      try {
        let clientId = row.clientId;
        if (row.action === "create") {
          const { data, error } = await supabase.from("clients").insert({
            name: row.label, client_type: row.newType, status: row.newStatus,
            wants_events: optWantsEvents,
            notes: `Creado desde Event Manager · ${evTitle}${dateRange ? ` (${dateRange})` : ""}`,
          }).select("id").single();
          if (error) throw error;
          clientId = data.id;
        } else if (optWantsEvents) {
          const { error } = await supabase.from("clients").update({ wants_events: true }).eq("id", clientId);
          if (error) throw error;
        }
        if (optContacts && row.visitors.length) {
          const { data: existing, error: e2 } = await supabase.from("contacts").select("name").eq("client_id", clientId);
          if (e2) throw e2;
          const have = new Set((existing || []).map(c => normName(c.name)));
          const news = row.visitors
            .filter(v => !have.has(normName(v.name)))
            .map(v => ({ client_id: clientId, name: v.name, role: v.title || null, email: v.email || null }));
          if (news.length) {
            const { error: e3 } = await supabase.from("contacts").insert(news);
            if (e3) throw e3;
          }
        }
        let interactionId = crmSync[row.fundId]?.clientId === clientId ? (crmSync[row.fundId]?.interactionId || null) : null;
        if (optInteraction) {
          const payload = {
            client_id: clientId, happened_at: row.happenedAt, channel: "reunion",
            topics: ["Event"], summary: row.summary, created_by: authUser?.email || null,
          };
          if (interactionId) {
            const { data: upd, error: e4 } = await supabase.from("interactions").update(payload).eq("id", interactionId).select("id");
            if (e4) throw e4;
            if (!upd?.length) interactionId = null; // la borraron en el CRM → recrear
          }
          if (!interactionId) {
            const { data: ins, error: e5 } = await supabase.from("interactions").insert(payload).select("id").single();
            if (e5) throw e5;
            interactionId = ins.id;
          }
        }
        crmSync[row.fundId] = {
          clientId, interactionId,
          clientName: row.action === "create" ? row.label : (clientsById.get(clientId)?.name || row.label),
          syncedAt: new Date().toISOString(),
        };
        results[row.fundId] = { ok: true, created: row.action === "create" };
      } catch (err) {
        results[row.fundId] = { ok: false, msg: err?.message || String(err) };
      }
    }
    saveRoadshow(cur => ({ ...cur, crmSync: { ...(cur.crmSync || {}), ...crmSync } }));
    setBusy(false); setDone(prev => ({ ...(prev || {}), ...results }));
    const ok = Object.values(results).filter(r => r.ok).length;
    const bad = Object.values(results).length - ok;
    if (!bad) toastOk(`✅ ${ok} inversor${ok !== 1 ? "es" : ""} subido${ok !== 1 ? "s" : ""} al CRM`);
    else toastErr(`⚠️ ${ok} OK · ${bad} con error — mirá el detalle en el modal`);
  }

  const fmtSyncDate = iso => { try { return new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short" }); } catch { return ""; } };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Subir inversores al CRM"
      onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}
      onKeyDown={e => { if (e.key === "Escape" && !busy) onClose(); }}>
      <FocusTrap><div className="modal" style={{ maxWidth: 640, width: "95%", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div className="modal-hdr">
          <div className="modal-title">⬆️ Subir inversores al CRM</div>
        </div>
        <div className="modal-body" style={{ overflowY: "auto" }}>
          {clients === null && <div style={{ padding: 20, textAlign: "center", color: "var(--dim)", fontSize: 12 }}>Cargando clientes del CRM…</div>}
          {loadErr && (
            <div style={{ padding: "12px 14px", background: "rgba(176,48,48,.08)", border: "1px solid rgba(176,48,48,.25)", borderRadius: 8, fontSize: 12, color: "#b03030", marginBottom: 12 }}>
              No pude leer el CRM: {loadErr}. Verificá que tu usuario tenga acceso (allowlist del CRM).
            </div>
          )}
          {clients !== null && !loadErr && !rows.length && (
            <div style={{ padding: 20, textAlign: "center", color: "var(--dim)", fontSize: 12 }}>
              El viaje no tiene ningún fondo con nombre todavía. Cargalo en ⚙️ Configuración.
            </div>
          )}
          {rows.length > 0 && (<>
            <p style={{ fontSize: 11, color: "var(--dim)", lineHeight: 1.6, margin: "0 0 12px" }}>
              Por cada fondo del viaje: elegí a qué cliente del CRM corresponde (o crealo). Se registra la
              participación como <strong>interacción</strong> en su ficha y los visitantes se suben como contactos.
              Re-sincronizar <strong>actualiza</strong> la misma interacción, no duplica.
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14, fontSize: 11 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                <input type="checkbox" checked={optInteraction} onChange={e => setOptInteraction(e.target.checked)} /> Registrar interacción</label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                <input type="checkbox" checked={optContacts} onChange={e => setOptContacts(e.target.checked)} /> Subir visitantes como contactos</label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                <input type="checkbox" checked={optWantsEvents} onChange={e => setOptWantsEvents(e.target.checked)} /> Marcar "invitar a eventos"</label>
            </div>
            {rows.map(row => {
              const res = done?.[row.fundId];
              return (
                <div key={row.fundId} style={{ border: "1px solid rgba(30,90,176,.14)", borderRadius: 10, padding: "10px 14px", marginBottom: 10, background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--cream)" }}>{row.label}</span>
                    <span style={{ fontSize: 9, color: "var(--dim)", fontFamily: "IBM Plex Mono,monospace" }}>
                      {row.visitors.length} visitante{row.visitors.length !== 1 ? "s" : ""} · {row.mtgCount} reunion{row.mtgCount !== 1 ? "es" : ""}</span>
                    {row.prev && <span style={{ fontSize: 9, background: "rgba(58,140,92,.12)", color: "#3a8c5c", padding: "1px 7px", borderRadius: 4 }}>
                      ✓ ya subido {fmtSyncDate(row.prev.syncedAt)} → {row.prev.clientName}</span>}
                    {res && (res.ok
                      ? <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "#3a8c5c" }}>{res.created ? "✅ creado" : "✅ actualizado"}</span>
                      : <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "#b03030" }} title={res.msg}>❌ {res.msg?.slice(0, 60)}</span>)}
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                    <select className="sel" style={{ fontSize: 11, padding: "4px 8px", minWidth: 250, height: "auto", flex: 1 }} disabled={busy}
                      value={row.action === "link" ? row.clientId : row.action}
                      onChange={e => {
                        const v = e.target.value;
                        if (v === "create" || v === "skip") setRow(row.fundId, { action: v, clientId: "" });
                        else setRow(row.fundId, { action: "link", clientId: v });
                      }}>
                      {row.sugs.length > 0 && <optgroup label="Sugeridos">
                        {row.sugs.map(s => <option key={s.c.id} value={s.c.id}>🔗 {s.c.name} ({s.c.status}) · {Math.round(s.score * 100)}%</option>)}
                      </optgroup>}
                      <option value="create">➕ Crear cliente nuevo en el CRM</option>
                      <option value="skip">⏭ No subir este fondo</option>
                      <optgroup label="Todos los clientes del CRM">
                        {(clients || []).map(c => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
                      </optgroup>
                    </select>
                    {row.action === "create" && (<>
                      <select className="sel" style={{ fontSize: 11, padding: "4px 8px", height: "auto" }} disabled={busy}
                        value={row.newType} onChange={e => setRow(row.fundId, { newType: e.target.value })}>
                        {CRM_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                      <select className="sel" style={{ fontSize: 11, padding: "4px 8px", height: "auto" }} disabled={busy}
                        value={row.newStatus} onChange={e => setRow(row.fundId, { newStatus: e.target.value })}>
                        <option value="prospecto">prospecto</option>
                        <option value="activo">activo</option>
                      </select>
                    </>)}
                  </div>
                  {optInteraction && row.action !== "skip" && (
                    <div style={{ fontSize: 9.5, color: "var(--dim)", fontFamily: "IBM Plex Mono,monospace", marginTop: 7, lineHeight: 1.5, background: "rgba(30,90,176,.05)", borderRadius: 6, padding: "5px 9px" }}>
                      📝 {row.summary}
                    </div>
                  )}
                </div>
              );
            })}
          </>)}
        </div>
        <div className="modal-footer" style={{ gap: 7 }}>
          <button className="btn bo bs" disabled={busy} onClick={onClose}>{done ? "Cerrar" : "Cancelar"}</button>
          {rows.length > 0 && pending.length > 0 && (
            <button className="btn bg bs" disabled={busy} onClick={runSync}>
              {busy ? "Subiendo…" : done ? `🔁 Reintentar ${pending.length} fallido${pending.length !== 1 ? "s" : ""}` : `⬆️ Subir ${pending.length} al CRM`}
            </button>
          )}
        </div>
      </div></FocusTrap>
    </div>
  );
}
