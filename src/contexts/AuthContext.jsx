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
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
