// ── AuthContext.jsx — Shared auth state to eliminate prop drilling ──
import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../../supabase.js";

const AuthCtx = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authView, setAuthView] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPwd, setAuthPwd] = useState("");
  const [authName, setAuthName] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  // Per-user Resend API key — stored in the ls_resend_keys table (strict RLS),
  // never in the ls_events JSON blob (which is shared with collaborators).
  const [resendKey, setResendKey] = useState("");
  const [resendKeyLoaded, setResendKeyLoaded] = useState(false);

  // Load the current user's Resend key from the secrets table.
  async function loadResendKey() {
    try {
      const { data } = await supabase.from("ls_resend_keys").select("api_key").maybeSingle();
      setResendKey(data?.api_key || "");
    } catch { /* table may not exist yet — silent */ }
    setResendKeyLoaded(true);
  }

  // Save / clear the current user's Resend key.
  // Empty string ⇒ delete the row entirely.
  async function saveResendKey(newKey) {
    if (!authUser?.id) return { error: new Error("Not signed in") };
    const trimmed = (newKey || "").trim();
    if (!trimmed) {
      const { error } = await supabase.from("ls_resend_keys").delete().eq("owner_id", authUser.id);
      if (!error) setResendKey("");
      return { error };
    }
    const { error } = await supabase
      .from("ls_resend_keys")
      .upsert({ owner_id: authUser.id, api_key: trimmed }, { onConflict: "owner_id" });
    if (!error) setResendKey(trimmed);
    return { error };
  }

  // Listen for auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user || null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      setAuthUser(session?.user || null);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load the Resend key whenever auth becomes ready with a user
  useEffect(() => {
    if (authUser?.id) loadResendKey();
    else { setResendKey(""); setResendKeyLoaded(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  async function signIn() {
    setAuthBusy(true); setAuthErr("");
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPwd });
    setAuthBusy(false);
    if (error) setAuthErr(error.message);
  }

  async function signUp() {
    setAuthBusy(true); setAuthErr("");
    const { error } = await supabase.auth.signUp({ email: authEmail, password: authPwd, options: { data: { name: authName } } });
    setAuthBusy(false);
    if (error) setAuthErr(error.message);
    else setAuthErr("✅ Verificá tu email para activar la cuenta.");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setAuthUser(null); setAuthLoading(false);
  }

  const value = {
    authUser, authLoading, authView, setAuthView,
    authEmail, setAuthEmail, authPwd, setAuthPwd,
    authName, setAuthName, authErr, setAuthErr, authBusy,
    signIn, signUp, signOut,
    resendKey, resendKeyLoaded, saveResendKey, loadResendKey,
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
