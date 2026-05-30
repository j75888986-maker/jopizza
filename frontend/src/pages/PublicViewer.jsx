import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from "lucide-react";
import { useVideoPlayer, fmtTime } from "@/hooks/useVideoPlayer";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND = process.env.REACT_APP_BACKEND_URL;

/** Public viewer page used for /v/:id (shareable) AND /embed/:id (iframe). No auth required. */
export default function PublicViewer({ embed = false }) {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    axios.get(`${API}/public/videos/${id}`)
      .then(r => setData(r.data))
      .catch(e => setErr(e?.response?.data?.detail || "Video not found"));
  }, [id]);

  const {
    ref, playing, progress, duration, muted, heatmap,
    onLoadedMetadata, onTimeUpdate, toggle, seek, reset, toggleMute, requestFullscreen,
  } = useVideoPlayer({ videoId: id });

  if (err) return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="nb-card text-center">
        <h1 className="font-heading text-2xl mb-2">Oh no — video unavailable</h1>
        <p className="text-ink/70">{err}</p>
      </div>
    </div>
  );
  if (!data) return <div className="min-h-screen bg-cream flex items-center justify-center font-heading">Loading…</div>;

  const src = data.url?.startsWith("/api/") ? `${BACKEND}${data.url}` : data.url;
  const brandColor = data.brand?.color || "#FF6B6B";
  const logoText = data.brand?.logo_text || "Looma";
  const bucket = 40;
  const heatmapDisplay = Array.from({ length: bucket }, (_, i) => heatmap.find(h => h.index === i)?.intensity ?? 0.08);

  const player = (
    <div className="relative w-full aspect-video bg-ink rounded-2xl nb-border nb-shadow-lg overflow-hidden group" data-testid="public-player">
      <video ref={ref} src={src} poster={data.thumbnail || undefined}
        className="w-full h-full object-contain bg-black"
        onLoadedMetadata={onLoadedMetadata} onTimeUpdate={onTimeUpdate}
        onClick={toggle} playsInline crossOrigin="anonymous"/>
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full nb-border text-sm font-heading font-black flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: brandColor }}/>{logoText}
      </div>
      {!playing && (
        <button onClick={toggle} aria-label="Play" data-testid="public-play"
          className="absolute inset-0 m-auto w-20 h-20 rounded-full nb-border text-white flex items-center justify-center shadow-[6px_6px_0_0_rgba(0,0,0,0.6)] transition-transform hover:scale-110"
          style={{ background: brandColor }}>
          <Play size={32} fill="white"/>
        </button>
      )}
      <div className={`absolute bottom-0 left-0 right-0 p-3 transition-opacity opacity-0 group-hover:opacity-100 ${!playing ? 'opacity-100' : ''} bg-gradient-to-t from-black/80 to-transparent`}>
        <div className="flex items-end gap-[2px] h-5 mb-1 px-1">
          {heatmapDisplay.map((h, i) => (
            <div key={`seg-${i}`} className="flex-1 rounded-sm"
              style={{ height: `${Math.max(h*100,8)}%`, background: `hsla(168,47%,72%,${0.35 + h*0.6})` }}/>
          ))}
        </div>
        <div className="relative h-3 bg-white/25 rounded-full cursor-pointer mb-2" onClick={seek}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress}%`, background: brandColor }}/>
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full nb-border bg-white" style={{ left: `calc(${progress}% - 8px)` }}/>
        </div>
        <div className="flex items-center justify-between text-white text-sm font-bold">
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="p-2 rounded-full hover:bg-white/15">{playing ? <Pause size={18}/> : <Play size={18} fill="white"/>}</button>
            <button onClick={reset} className="p-2 rounded-full hover:bg-white/15"><RotateCcw size={16}/></button>
            <button onClick={toggleMute} className="p-2 rounded-full hover:bg-white/15">{muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}</button>
            <span className="ml-2">{fmtTime((progress/100)*duration)} / {fmtTime(duration)}</span>
          </div>
          <button onClick={requestFullscreen} className="p-2 rounded-full hover:bg-white/15"><Maximize size={16}/></button>
        </div>
      </div>
    </div>
  );

  if (embed) {
    return <div className="w-screen h-screen bg-black flex items-center justify-center">{player}</div>;
  }
  return (
    <div className="min-h-screen bg-cream py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <a href="/" className="inline-flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-2xl bg-coral nb-border flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <span className="font-heading text-xl">Looma</span>
        </a>
        <h1 className="font-heading text-3xl md:text-4xl mb-2">{data.title}</h1>
        {data.description && <p className="text-ink/70 mb-5">{data.description}</p>}
        {player}
        <div className="text-center mt-8">
          <a href="/signup" className="nb-btn">Create your own with Looma →</a>
        </div>
      </div>
    </div>
  );
}
