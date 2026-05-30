import { createContext, useContext, useEffect, useState, useCallback } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("looma_token"));
  const [loading, setLoading] = useState(true);

  const authHeader = useCallback(() => token ? { Authorization: `Bearer ${token}` } : {}, [token]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) { setLoading(false); return; }
      try {
        const r = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (active) setUser(r.data);
      } catch {
        localStorage.removeItem("looma_token");
        if (active) { setUser(null); setToken(null); }
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [token]);

  const persist = (t, u) => {
    localStorage.setItem("looma_token", t);
    setToken(t); setUser(u);
  };

  const login = async (email, password) => {
    const r = await axios.post(`${API}/auth/login`, { email, password });
    persist(r.data.access_token, r.data.user);
    return r.data.user;
  };

  const register = async (email, password, name) => {
    const r = await axios.post(`${API}/auth/register`, { email, password, name });
    persist(r.data.access_token, r.data.user);
    return r.data.user;
  };

  const loginWithGoogleSession = async (sessionId) => {
    const r = await axios.post(`${API}/auth/google/session`, {}, { headers: { "X-Session-ID": sessionId } });
    persist(r.data.access_token, r.data.user);
    return r.data.user;
  };

  const startGoogleLogin = () => {
    const redirect = `${window.location.origin}/auth/callback`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
  };

  const logout = () => {
    localStorage.removeItem("looma_token");
    setToken(null); setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, loginWithGoogleSession, startGoogleLogin, authHeader, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
