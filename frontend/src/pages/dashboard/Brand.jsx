import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { Palette, Upload, Check, Download } from "lucide-react";
import { toast } from "sonner";
import VideoPlayer from "@/components/VideoPlayer";

const PALETTE = ["#FF6B6B", "#1D1A3F", "#98D8C8", "#F4D068", "#7A5FFF", "#FF8C42"];

export default function Brand() {
  const { authHeader, API } = useAuth();
  const [brand, setBrand] = useState({ color: "#FF6B6B", logo_text: "Looma", default_thumbnail: "", autoplay: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/brand`, { headers: authHeader() }).then(r => setBrand({ ...brand, ...r.data })).catch(()=>{});
  }, []);   // eslint-disable-line

  const save = async () => {
    setSaving(true);
    try {
      const r = await axios.put(`${API}/brand`, brand, { headers: authHeader() });
      setBrand({ ...brand, ...r.data });
      toast.success("Brand saved — applies to all your players");
    } catch { toast.error("Save failed"); } finally { setSaving(false); }
  };

  const exportData = async () => {
    try {
      const r = await axios.get(`${API}/admin/export`, { headers: authHeader() });
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `looma-export-${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast.success("Your data exported");
    } catch { toast.error("Export failed"); }
  };

  return (
    <div className="p-8 md:p-10 max-w-7xl">
      <div className="flex justify-between items-start mb-7 flex-wrap gap-3">
        <div>
          <div className="font-hand text-2xl text-coral">your colors, your rules</div>
          <h1 className="font-heading text-4xl">Brand</h1>
        </div>
        <button onClick={exportData} className="nb-btn nb-btn-ghost text-sm" data-testid="brand-export"><Download size={14}/> Export my data</button>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-5">
          <div className="nb-card">
            <h3 className="font-heading text-xl mb-4 flex items-center gap-2"><Palette size={20}/> Player color</h3>
            <div className="grid grid-cols-6 gap-3">
              {PALETTE.map(c => (
                <button key={c} onClick={()=>setBrand({...brand, color: c})} aria-label={c} data-testid={`brand-color-${c}`}
                  className="w-full aspect-square rounded-xl nb-border relative" style={{ background: c }}>
                  {brand.color===c && <Check className="absolute inset-0 m-auto text-white" size={20}/>}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <label className="font-heading text-xs mb-1.5 block">Custom hex</label>
              <input type="text" className="nb-input" value={brand.color} onChange={e=>setBrand({...brand, color: e.target.value})}/>
            </div>
          </div>
          <div className="nb-card">
            <h3 className="font-heading text-xl mb-3">Logo text</h3>
            <input className="nb-input" value={brand.logo_text} onChange={e=>setBrand({...brand, logo_text: e.target.value})} placeholder="Your brand" data-testid="brand-logo-input"/>
            <p className="text-sm text-ink/70 mt-2">Shown as a watermark on every player.</p>
          </div>
          <div className="nb-card">
            <h3 className="font-heading text-xl mb-3 flex items-center gap-2"><Upload size={20}/> Default thumbnail URL</h3>
            <input className="nb-input" value={brand.default_thumbnail} onChange={e=>setBrand({...brand, default_thumbnail: e.target.value})} placeholder="https://..."/>
          </div>
          <label className="nb-card flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={!!brand.autoplay} onChange={e=>setBrand({...brand, autoplay: e.target.checked})} className="w-5 h-5"/>
            <div>
              <div className="font-heading">Autoplay videos</div>
              <p className="text-sm text-ink/70">Many browsers require muted autoplay.</p>
            </div>
          </label>
          <button onClick={save} disabled={saving} className="nb-btn w-full" data-testid="brand-save">{saving ? "Saving…" : "Save brand defaults"}</button>
        </div>

        <div>
          <h3 className="font-heading text-xl mb-4">Live preview</h3>
          <VideoPlayer
            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            brandColor={brand.color}
            logoText={brand.logo_text || "Looma"}
            thumbnail={brand.default_thumbnail || "https://images.unsplash.com/photo-1758613656365-5195c3b96ba3?w=1200"}
          />
          <p className="text-sm text-ink/70 mt-3">These defaults apply automatically to every new video — and to public embeds & shareable links.</p>
        </div>
      </div>
    </div>
  );
}
