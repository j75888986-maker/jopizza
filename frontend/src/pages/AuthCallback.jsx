import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export default function AuthCallback() {
  const { loginWithGoogleSession } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
    const sid = params.get("session_id");
    if (!sid) { toast.error("Missing session"); nav("/login"); return; }
    (async () => {
      try { await loginWithGoogleSession(sid); toast.success("Signed in with Google"); nav("/app"); }
      catch { toast.error("Google sign-in failed"); nav("/login"); }
    })();
  }, [loginWithGoogleSession, nav]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="text-center">
        <div className="font-heading text-3xl mb-2">Finishing your sign in…</div>
        <div className="font-hand text-2xl text-coral">hang tight ✨</div>
      </div>
    </div>
  );
}
