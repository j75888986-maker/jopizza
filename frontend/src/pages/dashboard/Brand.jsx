import { useState } from "react";
import { Palette, Upload, Check } from "lucide-react";
import { toast } from "sonner";
import VideoPlayer from "@/components/VideoPlayer";

const PALETTE = ["#FF6B6B", "#1D1A3F", "#98D8C8", "#F4D068", "#7A5FFF", "#FF8C42"];

export default function Brand() {
  const [color, setColor] = useState("#FF6B6B");
  const [logo, setLogo] = useState("Looma");

  return (
    <div className="p-8 md:p-10 max-w-7xl">
      <div className="mb-7">
        <div className="font-hand text-2xl text-coral">your colors, your rules</div>
        <h1 className="font-heading text-4xl">Brand</h1>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-5">
          <div className="nb-card">
            <h3 className="font-heading text-xl mb-4 flex items-center gap-2"><Palette size={20}/> Player color</h3>
            <div className="grid grid-cols-6 gap-3">
              {PALETTE.map(c => (
                <button key={c} onClick={()=>setColor(c)} aria-label={c} data-testid={`brand-color-${c}`}
                  className="w-full aspect-square rounded-xl nb-border relative" style={{ background: c }}>
                  {color===c && <Check className="absolute inset-0 m-auto text-white" size={20}/>}
                </button>
              ))}
            </div>
          </div>
          <div className="nb-card">
            <h3 className="font-heading text-xl mb-3">Logo text</h3>
            <input className="nb-input" value={logo} onChange={e=>setLogo(e.target.value)} placeholder="Your brand" data-testid="brand-logo-input"/>
            <p className="text-sm text-ink/70 mt-2">Shown as a watermark on the player.</p>
          </div>
          <div className="nb-card">
            <h3 className="font-heading text-xl mb-3 flex items-center gap-2"><Upload size={20}/> Default thumbnail</h3>
            <div className="aspect-video rounded-xl nb-border bg-mint flex items-center justify-center text-ink/60 cursor-pointer hover:bg-gold/40 transition">
              <div className="text-center"><Upload size={28} className="mx-auto mb-2"/><span className="font-bold">Click to upload</span></div>
            </div>
          </div>
          <button onClick={()=>toast.success("Brand saved!")} className="nb-btn w-full" data-testid="brand-save">Save brand defaults</button>
        </div>

        <div>
          <h3 className="font-heading text-xl mb-4">Live preview</h3>
          <VideoPlayer
            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            brandColor={color}
            logoText={logo}
            thumbnail="https://images.unsplash.com/photo-1758613656365-5195c3b96ba3?w=1200"
          />
        </div>
      </div>
    </div>
  );
}
