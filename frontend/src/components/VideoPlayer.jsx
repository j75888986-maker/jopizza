import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from "lucide-react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Wistia-style custom video player with:
 *  - Big play overlay (brand color)
 *  - Custom controls (play/pause, scrub, volume, fullscreen)
 *  - Real heatmap visualization from /api/videos/:id/heatmap
 *  - 5-second segment view tracking via /api/videos/:id/segment
 *  - View tracking on first play
 */
export default function VideoPlayer({ src, videoId, brandColor = "#FF6B6B", logoText = "Looma", thumbnail = "", externalSessionId }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [heatmap, setHeatmap] = useState([]);    // [{ index, intensity, ... }]
  const [bucketCount, setBucketCount] = useState(40);
  const sessionId = useRef(externalSessionId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)));
  const sentSegments = useRef(new Set()); // segments sent as "watch" in this session
  const lastSegment = useRef(-1);
  const lastTimeRef = useRef(0);

  // Load heatmap
  useEffect(() => {
    if (!videoId) return;
    axios.get(`${API}/videos/${videoId}/heatmap`)
      .then(r => setHeatmap(r.data.segments || []))
      .catch(() => {});
  }, [videoId]);

  const reloadHeatmap = useCallback(() => {
    if (!videoId) return;
    axios.get(`${API}/videos/${videoId}/heatmap`).then(r => setHeatmap(r.data.segments || [])).catch(()=>{});
  }, [videoId]);

  // Track segment events
  const trackSegment = useCallback((segIdx, action) => {
    if (!videoId || segIdx < 0) return;
    if (action === "watch" && sentSegments.current.has(segIdx)) return;
    if (action === "watch") sentSegments.current.add(segIdx);
    axios.post(`${API}/videos/${videoId}/segment`, {
      video_id: videoId, session_id: sessionId.current, segment_index: segIdx, action
    }).catch(()=>{});
  }, [videoId]);

  const onLoaded = () => {
    const d = ref.current?.duration || 0;
    setDuration(d);
    setBucketCount(Math.max(20, Math.min(80, Math.ceil(d / 5))));
  };

  const onTime = () => {
    if (!ref.current) return;
    const t = ref.current.currentTime;
    const d = ref.current.duration || 1;
    setProgress((t / d) * 100);
    const seg = Math.floor(t / 5);
    // detect rewatch: jumped back to an earlier already-watched segment
    if (seg !== lastSegment.current) {
      if (seg < lastSegment.current && sentSegments.current.has(seg)) {
        trackSegment(seg, "rewatch");
      } else if (!sentSegments.current.has(seg)) {
        trackSegment(seg, "watch");
      }
      // detect skip: jumped forward by more than 1 segment
      if (lastSegment.current >= 0 && seg > lastSegment.current + 1) {
        trackSegment(lastSegment.current + 1, "skip");
      }
      lastSegment.current = seg;
    }
    lastTimeRef.current = t;
  };

  const toggle = () => {
    if (!ref.current) return;
    if (ref.current.paused) {
      ref.current.play();
      if (!tracked && videoId) {
        axios.post(`${API}/videos/${videoId}/view`).catch(()=>{});
        setTracked(true);
      }
    } else ref.current.pause();
  };

  useEffect(() => {
    const v = ref.current; if (!v) return;
    const p = () => setPlaying(true), pz = () => setPlaying(false);
    const ended = () => { reloadHeatmap(); };
    v.addEventListener("play", p); v.addEventListener("pause", pz); v.addEventListener("ended", ended);
    return () => { v.removeEventListener("play", p); v.removeEventListener("pause", pz); v.removeEventListener("ended", ended); };
  }, [reloadHeatmap]);

  const seek = (e) => {
    if (!ref.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    ref.current.currentTime = pct * (ref.current.duration || 0);
  };

  const fmt = (s) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2,"0")}`;
  };

  // Build display heatmap: combine real data with neutral baseline so empty videos still show a track
  const displayHeatmap = Array.from({ length: bucketCount }, (_, i) => {
    const real = heatmap.find(h => h.index === i);
    return real?.intensity ?? 0.08;
  });

  return (
    <div className="relative w-full aspect-video bg-ink rounded-2xl nb-border nb-shadow-lg overflow-hidden group"
         onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)} data-testid="video-player">
      <video ref={ref} src={src} poster={thumbnail || undefined} className="w-full h-full object-contain bg-black"
             onLoadedMetadata={onLoaded} onTimeUpdate={onTime} onClick={toggle} playsInline crossOrigin="anonymous"/>

      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full nb-border text-sm font-heading font-black flex items-center gap-1.5" data-testid="player-brand">
        <span className="w-2 h-2 rounded-full" style={{ background: brandColor }}/>{logoText}
      </div>

      {!playing && (
        <button onClick={toggle} aria-label="Play"
          className="absolute inset-0 m-auto w-20 h-20 rounded-full nb-border text-white flex items-center justify-center shadow-[6px_6px_0_0_rgba(0,0,0,0.6)] transition-transform hover:scale-110"
          style={{ background: brandColor }} data-testid="player-play-overlay">
          <Play size={32} fill="white" />
        </button>
      )}

      <div className={`absolute bottom-0 left-0 right-0 p-3 transition-opacity ${hovered || !playing ? 'opacity-100' : 'opacity-0'} bg-gradient-to-t from-black/80 to-transparent`}>
        <div className="flex items-end gap-[2px] h-6 mb-1 px-1" title="Engagement heatmap">
          {displayHeatmap.map((h, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(h * 100, 8)}%`,
              background: `hsla(168, 47%, 72%, ${0.35 + h*0.6})` }}/>
          ))}
        </div>
        <div className="relative h-3 bg-white/25 rounded-full cursor-pointer mb-2" onClick={seek} data-testid="player-scrubber">
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${progress}%`, background: brandColor }}/>
          <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full nb-border bg-white" style={{ left: `calc(${progress}% - 8px)` }}/>
        </div>
        <div className="flex items-center justify-between text-white text-sm font-bold">
          <div className="flex items-center gap-2">
            <button onClick={toggle} className="p-2 rounded-full hover:bg-white/15" data-testid="player-toggle">
              {playing ? <Pause size={18}/> : <Play size={18} fill="white"/>}
            </button>
            <button onClick={()=>{ if(ref.current){ ref.current.currentTime = 0; } }} className="p-2 rounded-full hover:bg-white/15"><RotateCcw size={16}/></button>
            <button onClick={()=>{ setMuted(m=>{ if(ref.current) ref.current.muted=!m; return !m; }); }} className="p-2 rounded-full hover:bg-white/15">{muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}</button>
            <span className="ml-2">{fmt((progress/100) * duration)} / {fmt(duration)}</span>
          </div>
          <button onClick={()=>{ ref.current?.requestFullscreen?.(); }} className="p-2 rounded-full hover:bg-white/15"><Maximize size={16}/></button>
        </div>
      </div>
    </div>
  );
}
