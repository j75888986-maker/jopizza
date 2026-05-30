// Sets up axios for cookie-based auth + CSRF double-submit token.
// Runs once at app start (imported by index.js).
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

axios.defaults.withCredentials = true;

function readCsrfCookie() {
  const m = document.cookie.match(/(?:^|;\s*)looma_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// Attach X-CSRF-Token on every state-changing request (matches double-submit cookie).
axios.interceptors.request.use((config) => {
  const method = (config.method || "get").toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const token = readCsrfCookie();
    if (token) config.headers["X-CSRF-Token"] = token;
  }
  return config;
});

// Lazy single-fetch of /api/csrf to seed the cookie if missing.
let bootstrapping = null;
export function ensureCsrf() {
  if (readCsrfCookie()) return Promise.resolve();
  if (!bootstrapping) bootstrapping = axios.get(`${API}/csrf`).catch(() => {}).finally(() => { bootstrapping = null; });
  return bootstrapping;
}

// Fire off the bootstrap immediately on import.
ensureCsrf();
