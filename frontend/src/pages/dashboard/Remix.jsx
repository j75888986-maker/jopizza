import { Scissors, Sparkles, Download } from "lucide-react";
import { Star, Heart } from "@/components/Doodles";

const clips = [
  { title: "Hook moment: the big reveal", duration: "0:42", engagement: 94 },
  { title: "Best customer quote", duration: "0:28", engagement: 88 },
  { title: "Top product demo", duration: "1:05", engagement: 81 },
  { title: "Behind-the-scenes laugh", duration: "0:18", engagement: 76 },
];

export default function Remix() {
  return (
    <div className="p-8 md:p-10 max-w-7xl">
      <div className="flex justify-between items-center mb-7 flex-wrap gap-4">
        <div>
          <div className="font-hand text-2xl text-coral">long → short</div>
          <h1 className="font-heading text-4xl">Remix</h1>
        </div>
        <button className="nb-btn" data-testid="remix-generate"><Sparkles size={18}/> Auto-find clips</button>
      </div>

      <div className="nb-border bg-mint rounded-3xl nb-shadow-lg p-8 mb-8 relative overflow-hidden">
        <Heart className="absolute top-6 right-8 w-12 h-12 wiggle"/>
        <Star className="absolute bottom-6 left-8 w-10 h-10 float-fast"/>
        <div className="relative max-w-2xl">
          <div className="font-hand text-2xl">try this ✨</div>
          <h2 className="font-heading text-2xl mb-2">Turn one webinar into a week of social posts.</h2>
          <p className="text-ink/80">Looma scans your long videos, finds the most engaging moments, and reframes them for Reels, Shorts, and TikTok.</p>
        </div>
      </div>

      <h3 className="font-heading text-2xl mb-4">Suggested clips from "Spring Webinar"</h3>
      <div className="grid md:grid-cols-2 gap-5">
        {clips.map((c, i) => (
          <div key={i} className="nb-card flex gap-4 hover:-translate-y-1 transition">
            <div className="w-24 h-32 rounded-xl nb-border bg-ink shrink-0 flex items-center justify-center text-white">
              <Scissors size={24}/>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-heading text-lg mb-1 truncate">{c.title}</h4>
              <div className="text-sm text-ink/70 mb-3">{c.duration} · {c.engagement}% engagement</div>
              <div className="flex gap-2">
                <button className="nb-btn nb-btn-gold text-sm py-2 px-4">Edit</button>
                <button className="nb-btn nb-btn-ghost text-sm py-2 px-4"><Download size={14}/> Export</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
