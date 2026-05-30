import { Radio, Users, Calendar, Plus } from "lucide-react";
import { Star, Sparkle } from "@/components/Doodles";

const sample = [
  { title: "Product Demo: Spring Release", date: "Mar 14 · 2:00 PM", reg: 1240, status: "Upcoming", color: "bg-coral text-white" },
  { title: "Office Hours with the CEO", date: "Mar 21 · 11:00 AM", reg: 480, status: "Upcoming", color: "bg-mint" },
  { title: "Webinar: SEO with Video", date: "Feb 28", reg: 2100, status: "Recorded", color: "bg-gold" },
];

export default function Webinars() {
  return (
    <div className="p-8 md:p-10 max-w-7xl">
      <div className="flex justify-between items-center mb-7 flex-wrap gap-4">
        <div>
          <div className="font-hand text-2xl text-coral">live & evergreen</div>
          <h1 className="font-heading text-4xl">Webinars</h1>
        </div>
        <button className="nb-btn" data-testid="webinar-create"><Plus size={18}/> Schedule webinar</button>
      </div>

      <div className="nb-border bg-gold rounded-3xl nb-shadow-lg p-8 mb-8 relative overflow-hidden">
        <Star className="absolute top-4 right-8 w-12 h-12 wiggle"/>
        <Sparkle className="absolute bottom-4 right-32 w-6 h-6"/>
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-coral nb-border flex items-center justify-center text-white"><Radio size={28}/></div>
          <div>
            <div className="font-hand text-xl">it's nearly time</div>
            <h2 className="font-heading text-3xl">Next live in 4 days</h2>
            <p className="text-ink/80">Product Demo: Spring Release — 1,240 registered</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sample.map(w => (
          <div key={w.title} className="nb-card hover:-translate-y-1 transition">
            <div className={`${w.color} rounded-xl nb-border px-3 py-1 inline-block font-bold text-xs mb-4`}>{w.status}</div>
            <h3 className="font-heading text-xl mb-2">{w.title}</h3>
            <div className="text-sm text-ink/70 flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1"><Calendar size={14}/> {w.date}</span>
              <span className="flex items-center gap-1"><Users size={14}/> {w.reg.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
