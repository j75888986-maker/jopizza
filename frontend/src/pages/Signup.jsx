import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { Heart, Star, Sparkle, Blob, SmileyPlay } from "@/components/Doodles";
import { Check } from "lucide-react";

export default function Signup() {
  const { register, startGoogleLogin } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    try { await register(form.email, form.password, form.name); toast.success("Welcome to Looma!"); nav("/app"); }
    catch (err) { toast.error(err.response?.data?.detail || "Signup failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-cream">
      <div className="flex-1 flex items-center justify-center px-6 py-12 order-2 lg:order-1">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-coral nb-border nb-shadow-sm flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span className="font-heading text-2xl">Looma</span>
          </Link>
          <h1 className="font-heading text-4xl mb-2">Create your Looma</h1>
          <p className="text-ink/70 mb-8">Already have one? <Link to="/login" className="text-coral font-bold underline">Sign in</Link></p>

          <button onClick={startGoogleLogin} className="nb-btn nb-btn-ghost w-full mb-6" data-testid="signup-google-btn">
            <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign up with Google
          </button>

          <div className="flex items-center gap-4 my-6"><div className="flex-1 h-0.5 bg-ink/20"/><span className="text-sm text-ink/60 font-bold">or with email</span><div className="flex-1 h-0.5 bg-ink/20"/></div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="font-heading text-sm mb-1.5 block">Name</label>
              <input data-testid="signup-name" required value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="nb-input" placeholder="Mia Park"/>
            </div>
            <div>
              <label className="font-heading text-sm mb-1.5 block">Email</label>
              <input data-testid="signup-email" type="email" required value={form.email} onChange={e=>setForm({...form, email:e.target.value})} className="nb-input" placeholder="hello@looma.app"/>
            </div>
            <div>
              <label className="font-heading text-sm mb-1.5 block">Password</label>
              <input data-testid="signup-password" type="password" required minLength={6} value={form.password} onChange={e=>setForm({...form, password:e.target.value})} className="nb-input" placeholder="At least 6 characters"/>
            </div>
            <button type="submit" disabled={loading} className="nb-btn w-full" data-testid="signup-submit">
              {loading ? "Creating..." : "Create account"}
            </button>
            <p className="text-xs text-ink/60 text-center">By signing up you agree to our nice & friendly Terms.</p>
          </form>
        </div>
      </div>

      <div className="hidden lg:flex w-1/2 bg-gold border-l-2 border-ink relative overflow-hidden items-center justify-center order-1 lg:order-2">
        <Blob className="absolute -bottom-32 -right-32 w-[500px] h-[500px] opacity-60" color="#FF6B6B"/>
        <Star className="absolute top-12 left-12 w-16 h-16 wiggle"/>
        <Heart className="absolute bottom-20 right-16 w-12 h-12 float-slow"/>
        <Sparkle className="absolute top-1/4 left-1/3 w-6 h-6"/>
        <div className="relative max-w-md px-8">
          <SmileyPlay className="w-24 h-24 mb-6 wiggle"/>
          <h2 className="font-heading text-4xl mb-4 leading-tight">Make videos<br/>people <span className="squiggle">finish</span> watching.</h2>
          <ul className="space-y-3 mt-8">
            {["Free forever plan", "Wistia-style player, your colors", "AI transcripts on every video", "Cancel anytime"].map(x =>
              <li key={x} className="flex items-center gap-2 font-heading text-lg"><Check className="text-coral"/> {x}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
