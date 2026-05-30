import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Radio, Users, Calendar, Plus, X, Trash2 } from "lucide-react";
import { Star, Sparkle } from "@/components/Doodles";

export default function Webinars() {
  const { authHeader, API } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", scheduled_at: "" });
  const [busy, setBusy] = useState(false);

  const load = () => axios.get(`${API}/webinars`, { headers: authHeader() }).then(r => setRows(r.data));
  useEffect(() => { load(); }, []);   // eslint-disable-line

  const create = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await axios.post(`${API}/webinars`, {
        ...form, scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      }, { headers: authHeader() });
      toast.success("Webinar created!");
      setShow(false); setForm({ title:"", description:"", scheduled_at:""});
      nav(`/app/webinars/${r.data.id}`);
    } catch { toast.error("Failed"); } finally { setBusy(false); }
  };

  const del = async (id) => {
    await axios.delete(`${API}/webinars/${id}`, { headers: authHeader() });
    toast.success("Deleted"); load();
  };

  return (
    <div className="p-8 md:p-10 max-w-7xl">
      <div className="flex justify-between items-center mb-7 flex-wrap gap-4">
        <div>
          <div className="font-hand text-2xl text-coral">live & evergreen</div>
          <h1 className="font-heading text-4xl">Webinars</h1>
        </div>
        <button onClick={()=>setShow(true)} className="nb-btn" data-testid="webinar-create"><Plus size={18}/> Schedule webinar</button>
      </div>

      {rows.length === 0 ? (
        <div className="nb-card text-center py-14">
          <Radio size={48} className="mx-auto mb-3 text-coral"/>
          <div className="font-heading text-xl mb-2">No webinars yet</div>
          <p className="text-ink/70 mb-5">Schedule your first one — registration page generates automatically.</p>
          <button onClick={()=>setShow(true)} className="nb-btn">Schedule webinar</button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {rows.map(w => {
            const color = { scheduled: "bg-gold", live: "bg-coral text-white", ended: "bg-mint" }[w.status] || "bg-white";
            return (
              <div key={w.id} className="nb-card hover:-translate-y-1 transition group cursor-pointer relative" onClick={()=>nav(`/app/webinars/${w.id}`)}>
                <div className={`${color} rounded-xl nb-border px-3 py-1 inline-flex items-center gap-1.5 font-bold text-xs mb-4 uppercase`}>
                  {w.status === "live" && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>}
                  {w.status}
                </div>
                <h3 className="font-heading text-xl mb-2 truncate">{w.title}</h3>
                <div className="text-sm text-ink/70 flex flex-wrap items-center gap-3 mb-4">
                  {w.scheduled_at && <span className="flex items-center gap-1"><Calendar size={14}/> {new Date(w.scheduled_at).toLocaleString()}</span>}
                  <span className="flex items-center gap-1"><Users size={14}/> {w.registrations_count}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); del(w.id); }} className="absolute top-3 right-3 p-2 rounded-lg hover:bg-coral hover:text-white transition opacity-0 group-hover:opacity-100"><Trash2 size={14}/></button>
              </div>
            );
          })}
        </div>
      )}

      {show && (
        <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-4" onClick={()=>setShow(false)}>
          <div className="bg-cream nb-border rounded-3xl nb-shadow-lg max-w-lg w-full p-7" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="font-heading text-2xl">Schedule webinar</h2>
              <button onClick={()=>setShow(false)} className="p-2 rounded-xl nb-border bg-white"><X size={18}/></button>
            </div>
            <form onSubmit={create} className="space-y-4">
              <div>
                <label className="font-heading text-sm mb-1.5 block">Title</label>
                <input required className="nb-input" value={form.title} onChange={e=>setForm({...form, title:e.target.value})} placeholder="Product Demo: Spring Release" data-testid="webinar-form-title"/>
              </div>
              <div>
                <label className="font-heading text-sm mb-1.5 block">Description</label>
                <textarea className="nb-input min-h-[100px]" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} placeholder="What attendees will learn..."/>
              </div>
              <div>
                <label className="font-heading text-sm mb-1.5 block">Date & time (optional)</label>
                <input type="datetime-local" className="nb-input" value={form.scheduled_at} onChange={e=>setForm({...form, scheduled_at:e.target.value})}/>
              </div>
              <button type="submit" disabled={busy} className="nb-btn w-full" data-testid="webinar-form-submit">{busy ? "Creating…" : "Create webinar"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
