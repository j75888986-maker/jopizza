import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { Link } from "react-router-dom";
import { Folder, Search, Plus, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import RecordModal from "@/components/RecordModal";

export default function ContentLibrary() {
  const { authHeader, API } = useAuth();
  const [videos, setVideos] = useState([]);
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState("All");
  const [showRec, setShowRec] = useState(false);

  const load = () => axios.get(`${API}/videos`, { headers: authHeader() }).then(r=>setVideos(r.data));
  useEffect(() => { load(); }, []); // eslint-disable-line

  const folders = ["All", ...new Set(videos.map(v => v.folder || "All Videos"))];
  const filtered = videos.filter(v =>
    (folder === "All" || v.folder === folder) &&
    v.title.toLowerCase().includes(q.toLowerCase())
  );

  const del = async (id) => {
    await axios.delete(`${API}/videos/${id}`, { headers: authHeader() });
    toast.success("Deleted");
    load();
  };

  return (
    <div className="p-8 md:p-10 max-w-7xl">
      <div className="flex items-center justify-between mb-7 flex-wrap gap-4">
        <div>
          <div className="font-hand text-2xl text-coral">your library</div>
          <h1 className="font-heading text-4xl">Content Library</h1>
        </div>
        <button onClick={()=>setShowRec(true)} className="nb-btn" data-testid="lib-create"><Plus size={18}/> New</button>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/50"/>
          <input className="nb-input pl-11" placeholder="Search videos..." value={q} onChange={e=>setQ(e.target.value)} data-testid="lib-search"/>
        </div>
        <div className="flex gap-2 flex-wrap">
          {folders.map(f => (
            <button key={f} onClick={()=>setFolder(f)} className={`px-4 py-2 rounded-full nb-border font-bold text-sm ${folder===f ? 'bg-ink text-white' : 'bg-white'}`}>
              <Folder size={14} className="inline mr-1.5"/>{f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="nb-card text-center py-14">
          <div className="font-heading text-xl mb-2">No videos found</div>
          <p className="text-ink/70 mb-5">Create your first one to get started.</p>
          <button onClick={()=>setShowRec(true)} className="nb-btn">Create video</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(v => (
            <div key={v.id} className="nb-card p-3 hover:-translate-y-1 transition group">
              <Link to={`/app/studio/${v.id}`} className="block">
                <div className="aspect-video rounded-xl nb-border bg-ink overflow-hidden mb-3 relative">
                  {v.thumbnail && <img src={v.thumbnail} alt="" className="w-full h-full object-cover"/>}
                  <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-coral nb-border flex items-center justify-center opacity-90 group-hover:scale-110 transition"><Play size={18} fill="white"/></div>
                </div>
              </Link>
              <div className="px-2 pb-2 flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <div className="font-heading font-bold truncate">{v.title}</div>
                  <div className="text-xs text-ink/60 flex items-center gap-2">
                    <span>{v.views} views</span>
                    {v.transcript_status === "pending" && <span className="bg-gold nb-border px-1.5 py-0.5 rounded-full text-[10px] font-bold">transcribing…</span>}
                    {v.transcript_status === "ready" && <span className="bg-mint nb-border px-1.5 py-0.5 rounded-full text-[10px] font-bold">captioned</span>}
                  </div>
                </div>
                <button onClick={()=>del(v.id)} className="p-2 rounded-lg hover:bg-coral hover:text-white transition"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showRec && <RecordModal onClose={()=>{setShowRec(false); load();}}/>}
    </div>
  );
}
