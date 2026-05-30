import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Home, Folder, Radio, Tv, BarChart3, Scissors, Pencil, Palette, LogOut, Plus } from "lucide-react";
import { useState } from "react";
import RecordModal from "./RecordModal";

const nav = [
  { to: "/app", end: true, icon: Home, label: "Home" },
  { to: "/app/library", icon: Folder, label: "Content Library" },
  { to: "/app/webinars", icon: Radio, label: "Webinars" },
  { to: "/app/channels", icon: Tv, label: "Channels" },
  { to: "/app/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/app/remix", icon: Scissors, label: "Remix" },
  { to: "/app/edit", icon: Pencil, label: "Edit" },
  { to: "/app/brand", icon: Palette, label: "Brand" },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const nav2 = useNavigate();
  const [showRec, setShowRec] = useState(false);

  return (
    <div className="min-h-screen flex bg-cream">
      <aside className="w-64 bg-cream border-r-2 border-ink flex flex-col sticky top-0 h-screen">
        <div className="p-5 border-b-2 border-ink">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-coral nb-border flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span className="font-heading text-xl">Looma</span>
          </div>
        </div>
        <div className="p-4">
          <button onClick={() => setShowRec(true)} className="nb-btn nb-btn-gold w-full" data-testid="sidebar-record-btn">
            <Plus size={18} strokeWidth={2.5}/> Create
          </button>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-thin">
          {nav.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} data-testid={`side-${label.toLowerCase().replace(/ /g,'-')}`}
              className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-xl font-heading font-bold text-[15px] transition-all ${isActive ? 'bg-ink text-white nb-shadow-sm' : 'text-ink hover:bg-white hover:nb-border'}`}>
              <Icon size={18} strokeWidth={2.5} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t-2 border-ink">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-9 h-9 rounded-full nb-border" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-mint nb-border flex items-center justify-center font-heading font-black">
                {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-heading font-bold text-sm truncate">{user?.name || user?.email}</div>
              <div className="text-xs text-ink/60 truncate">{user?.email}</div>
            </div>
          </div>
          <button onClick={() => { logout(); nav2("/"); }} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-ink bg-white font-bold text-sm hover:bg-coral hover:text-white transition" data-testid="sidebar-logout">
            <LogOut size={16}/> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
      {showRec && <RecordModal onClose={() => setShowRec(false)} />}
    </div>
  );
}
