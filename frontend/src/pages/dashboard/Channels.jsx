import { Tv, Plus, Eye } from "lucide-react";

const channels = [
  { name: "Product Tutorials", videos: 12, views: "23.4k", color: "bg-mint" },
  { name: "Customer Stories", videos: 8, views: "18.1k", color: "bg-gold" },
  { name: "Behind the Scenes", videos: 5, views: "9.7k", color: "bg-coral text-white" },
  { name: "Spring Campaign", videos: 4, views: "5.2k", color: "bg-white" },
];

export default function Channels() {
  return (
    <div className="p-8 md:p-10 max-w-7xl">
      <div className="flex justify-between items-center mb-7 flex-wrap gap-4">
        <div>
          <div className="font-hand text-2xl text-coral">video hubs</div>
          <h1 className="font-heading text-4xl">Channels</h1>
        </div>
        <button className="nb-btn" data-testid="channel-create"><Plus size={18}/> New channel</button>
      </div>

      <p className="text-ink/80 mb-6 max-w-2xl">Group videos into branded galleries and embed them anywhere with a single code snippet.</p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {channels.map(c => (
          <div key={c.name} className={`${c.color} nb-border rounded-2xl p-6 nb-shadow-lg hover:-translate-y-1 transition`}>
            <Tv size={28} strokeWidth={2.5} className="mb-3"/>
            <h3 className="font-heading text-xl mb-2">{c.name}</h3>
            <div className="flex gap-4 text-sm">
              <span>{c.videos} videos</span>
              <span className="flex items-center gap-1"><Eye size={14}/> {c.views}</span>
            </div>
            <button className="nb-btn nb-btn-ghost mt-4 text-sm py-2 px-4">View channel</button>
          </div>
        ))}
      </div>
    </div>
  );
}
