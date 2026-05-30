import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { Heart, Star, Sparkle, Blob, SmileyPlay } from "@/components/Doodles";

const HERO_IMG = "https://static.prod-images.emergentagent.com/jobs/f5c868bb-c528-4caa-a571-2da67658e4d9/images/ff98e7c10cc92d77823a81dc1b12270e7682541faa43bfb068a5dc424eb4c5ab.png";

export default function Login() {
  const { login, startGoogleLogin } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [show, setShow] = useState(false); const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try { await login(email, password); toast.success("Welcome back!"); nav("/app"); }
    catch (err) { toast.error(err.response?.data?.detail || "Login failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-cream">
      <div className="hidden lg:flex w-1/2 bg-mint border-r-2 border-ink relative overflow-hidden items-center justify-center">
        <Blob className="absolute -top-32 -left-32 w-[500px] h-[500px] opacity-50" color="#F4D068"/>
        <Star className="absolute top-12 right-12 w-16 h-16 wiggle"/>
        <Heart className="absolute bottom-16 left-16 w-12 h-12 float-fast"/>
        <Sparkle className="absolute top-1/3 right-1/4 w-6 h-6"/>
        <div className="relative text-center max-w-md px-8">
          <SmileyPlay className="w-24 h-24 mx-auto mb-6 wiggle"/>
          <h2 className="font-heading text-4xl mb-3">Welcome back to <span className="squiggle">Looma</span></h2>
          <p className="text-ink/80 text-lg">Your videos missed you.</p>
          <img src={HERO_IMG} alt="" className="mt-10 max-w-sm mx-auto rounded-2xl nb-border nb-shadow"/>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 mb-8" data-testid="login-logo">
            <div className="w-10 h-10 rounded-2xl bg-coral nb-border nb-shadow-sm flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span className="font-heading text-2xl">Looma</span>
          </Link>
          <h1 className="font-heading text-4xl mb-2">Sign in</h1>
          <p className="text-ink/70 mb-8">New here? <Link to="/signup" className="text-coral font-bold underline">Create an account</Link></p>

          <button onClick={startGoogleLogin} className="nb-btn nb-btn-ghost w-full mb-6" data-testid="login-google-btn">
            <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 my-6"><div className="flex-1 h-0.5 bg-ink/20"/><span className="text-sm text-ink/60 font-bold">or with email</span><div className="flex-1 h-0.5 bg-ink/20"/></div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="font-heading text-sm mb-1.5 block">Email</label>
              <input data-testid="login-email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="nb-input" placeholder="hello@looma.app"/>
            </div>
            <div>
              <label className="font-heading text-sm mb-1.5 block">Password</label>
              <div className="relative">
                <input data-testid="login-password" type={show ? "text":"password"} required value={password} onChange={e=>setPassword(e.target.value)} className="nb-input pr-12" placeholder="••••••••"/>
                <button type="button" onClick={()=>setShow(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/60">{show ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="nb-btn w-full" data-testid="login-submit">
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
