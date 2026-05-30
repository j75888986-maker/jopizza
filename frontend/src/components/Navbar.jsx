import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const links = [
    { to: "/", label: "Home" },
    { to: "/features", label: "Features" },
    { to: "/pricing", label: "Pricing" },
  ];
  return (
    <header className="sticky top-0 z-40 bg-cream/90 backdrop-blur border-b-2 border-ink">
      <div className="max-w-7xl mx-auto px-6 md:px-10 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group" data-testid="nav-logo">
          <div className="w-10 h-10 rounded-2xl bg-coral nb-border nb-shadow-sm flex items-center justify-center group-hover:rotate-6 transition-transform">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <span className="font-heading text-2xl tracking-tight">Looma</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end className={({isActive}) => `font-heading font-bold text-lg hover:text-coral transition-colors ${isActive ? 'text-coral' : 'text-ink'}`} data-testid={`nav-${l.label.toLowerCase()}`}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="nb-btn nb-btn-ghost" data-testid="nav-login">Sign in</Link>
          <Link to="/signup" className="nb-btn" data-testid="nav-signup">Get started</Link>
        </div>
        <button className="md:hidden nb-border rounded-xl p-2 bg-white" onClick={() => setOpen(o=>!o)} data-testid="nav-menu-toggle">
          {open ? <X size={22}/> : <Menu size={22}/>}
        </button>
      </div>
      {open && (
        <div className="md:hidden border-t-2 border-ink bg-cream px-6 py-4 space-y-3">
          {links.map(l => <Link key={l.to} to={l.to} onClick={()=>setOpen(false)} className="block font-heading font-bold text-lg">{l.label}</Link>)}
          <div className="flex gap-2 pt-3">
            <Link to="/login" className="nb-btn nb-btn-ghost flex-1">Sign in</Link>
            <Link to="/signup" className="nb-btn flex-1">Get started</Link>
          </div>
        </div>
      )}
    </header>
  );
}
