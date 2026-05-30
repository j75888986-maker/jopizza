import { Pencil, Music, Type, Wand2 } from "lucide-react";
import { Star } from "@/components/Doodles";

const transcript = [
  { t: "0:02", text: "Hey everyone — welcome to Looma, the friendliest way to publish video." },
  { t: "0:08", text: "Today I'll walk you through how text-based editing actually works." },
  { t: "0:14", text: "Watch as I delete this filler word right from the transcript..." },
  { t: "0:19", text: "And the video updates instantly. No timeline scrubbing required." },
  { t: "0:25", text: "You can also add background music with one click." },
];

export default function Edit() {
  return (
    <div className="p-8 md:p-10 max-w-7xl">
      <div className="mb-7">
        <div className="font-hand text-2xl text-coral">edit by typing</div>
        <h1 className="font-heading text-4xl">Editor</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="aspect-video rounded-2xl nb-border nb-shadow-lg bg-ink relative overflow-hidden flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-coral nb-border flex items-center justify-center text-white"><Pencil size={28}/></div>
            <Star className="absolute top-6 right-6 w-10 h-10 wiggle"/>
          </div>
          <div className="nb-card">
            <h3 className="font-heading text-xl mb-3 flex items-center gap-2"><Type size={20}/> Transcript</h3>
            <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-thin">
              {transcript.map((line, i) => (
                <div key={i} className="flex gap-3 px-3 py-2 rounded-lg hover:bg-gold/30 cursor-text">
                  <span className="font-bold text-coral text-sm w-12 shrink-0">{line.t}</span>
                  <p className="text-ink/90 leading-relaxed">{line.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="nb-card">
            <h3 className="font-heading text-lg mb-3 flex items-center gap-2"><Wand2 size={18}/> Tools</h3>
            <div className="space-y-2">
              <button className="nb-btn nb-btn-mint w-full justify-start text-sm py-2.5"><Music size={16}/> Add background music</button>
              <button className="nb-btn nb-btn-gold w-full justify-start text-sm py-2.5"><Type size={16}/> Add caption</button>
              <button className="nb-btn nb-btn-ghost w-full justify-start text-sm py-2.5"><Pencil size={16}/> Trim silences</button>
            </div>
          </div>
          <div className="nb-card bg-coral text-white">
            <div className="font-hand text-2xl">pro tip</div>
            <h4 className="font-heading text-lg mb-2">Highlight & delete</h4>
            <p className="text-white/90 text-sm">Select any word above and press delete — the video auto-cuts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
