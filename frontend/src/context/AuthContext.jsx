import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";
import { ensureCsrf } from "@/lib/http";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/auth/me`);
      setUser(r.data);
      return r.data;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    await ensureCsrf();
    const r = await axios.post(`${API}/auth/login`, { email, password });
    setUser(r.data.user);
    return r.data.user;
  }, []);

  const register = useCallback(async (email, password, name) => {
    await ensureCsrf();
    const r = await axios.post(`${API}/auth/register`, { email, password, name });
    setUser(r.data.user);
    return r.data.user;
  }, []);

  const loginWithGoogleSession = useCallback(async (sessionId) => {
    await ensureCsrf();
    const r = await axios.post(`${API}/auth/google/session`, {}, { headers: { "X-Session-ID": sessionId } });
    setUser(r.data.user);
    return r.data.user;
  }, []);

  const startGoogleLogin = useCallback(() => {
    const redirect = `${window.location.origin}/auth/callback`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
  }, []);

  const logout = useCallback(async () => {
    try { await axios.post(`${API}/auth/logout`); } catch (e) { console.warn("logout request failed", e); }
    setUser(null);
  }, []);

  // Auth header kept for backward compat with callers that explicitly pass it;
  // cookie is the primary auth mechanism.
  const authHeader = useCallback(() => ({}), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, loginWithGoogleSession, startGoogleLogin, authHeader, refresh, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
