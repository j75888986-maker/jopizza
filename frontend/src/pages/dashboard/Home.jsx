import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";
import axios from "axios";
import { Plus, Play, Eye, TrendingUp, Clock } from "lucide-react";
import { Star, Heart, Sparkle, SmileyPlay } from "@/components/Doodles";
import { useNavigate } from "react-router-dom";
import RecordModal from "@/components/RecordModal";

export default function DashHome() {
  const { user, authHeader, API } = useAuth();
  const [videos, setVideos] = useState([]);
  const [stats, setStats] = useState(null);
  const [showRec, setShowRec] = useState(false);
  const nav = useNavigate();

  const loadVideos = useCallback(() => {
    axios.get(`${API}/videos`, { headers: authHeader() }).then(r=>setVideos(r.data)).catch(()=>{});
  }, [API, authHeader]);

  const loadStats = useCallback(() => {
    axios.get(`${API}/analytics/overview`, { headers: authHeader() }).then(r=>setStats(r.data)).catch(()=>{});
  }, [API, authHeader]);

  useEffect(() => {
    loadVideos();
    loadStats();
  }, [loadVideos, loadStats]);

  return (
    <div className="p-8 md:p-10 max-w-7xl">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="font-hand text-2xl text-coral">welcome back ✨</div>
          <h1 className="font-heading text-4xl">Hi {user?.name?.split(' ')[0] || 'there'}!</h1>
        </div>
        <button onClick={()=>setShowRec(true)} className="nb-btn" data-testid="dash-create-btn">
          <Plus size={18} strokeWidth={2.5}/> New video
        </button>
      </div>

      {/* Record callout */}
      <div className="nb-border bg-mint rounded-3xl nb-shadow-lg p-8 mb-8 relative overflow-hidden">
        <Star className="absolute top-4 right-8 w-12 h-12 wiggle"/>
        <Heart className="absolute bottom-4 left-8 w-10 h-10 float-fast"/>
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <SmileyPlay className="w-20 h-20 wiggle"/>
            <div>
              <div className="font-hand text-2xl">no pressure</div>
              <h2 className="font-heading text-3xl mb-1">Record a test one now</h2>
              <p className="text-ink/80">Try the webcam + screen recorder — takes 30 seconds.</p>
            </div>
          </div>
          <button onClick={()=>setShowRec(true)} className="nb-btn nb-btn-dark text-lg" data-testid="dash-record-cta">
            <Play size={18} fill="white"/> Start recording
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Videos", val: stats?.total_videos ?? videos.length, icon: Play, bg: "bg-coral", fg:"text-white" },
          { label: "Total views", val: stats?.total_views ?? 0, icon: Eye, bg: "bg-gold" },
          { label: "Plays", val: stats?.total_plays ?? 0, icon: TrendingUp, bg: "bg-mint" },
          { label: "Avg engagement", val: `${stats?.avg_engagement ?? 0}%`, icon: Clock, bg: "bg-white" },
        ].map(s => (
          <div key={s.label} className={`nb-border ${s.bg} rounded-2xl p-5 nb-shadow-sm ${s.fg || ''}`}>
            <div className="flex items-center justify-between mb-2"><s.icon size={20} strokeWidth={2.5}/><Sparkle className="w-4 h-4"/></div>
            <div className="font-heading text-3xl">{s.val}</div>
            <div className="text-sm opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      <h2 className="font-heading text-2xl mb-4">Recent videos</h2>
      {videos.length === 0 ? (
        <div className="nb-card text-center py-14">
          <SmileyPlay className="w-20 h-20 mx-auto mb-4 wiggle"/>
          <div className="font-heading text-xl mb-2">No videos yet</div>
          <p className="text-ink/70 mb-5">Your masterpieces will appear here.</p>
          <button onClick={()=>setShowRec(true)} className="nb-btn" data-testid="dash-empty-create">Create first video</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {videos.slice(0, 6).map(v => (
            <Link to={`/app/studio/${v.id}`} key={v.id} className="nb-card p-3 hover:-translate-y-1 transition-transform">
              <div className="aspect-video rounded-xl nb-border bg-ink overflow-hidden mb-3 relative">
                {v.thumbnail && <img src={v.thumbnail} alt="" className="w-full h-full object-cover"/>}
                <div className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-coral nb-border flex items-center justify-center"><Play size={18} fill="white"/></div>
              </div>
              <div className="px-2 pb-2">
                <div className="font-heading font-bold truncate">{v.title}</div>
                <div className="text-xs text-ink/60 mt-1">{v.views} views · {v.folder}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {showRec && <RecordModal onClose={()=>setShowRec(false)}/>}
    </div>
  );
}
