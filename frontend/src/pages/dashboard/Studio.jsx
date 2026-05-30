import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import VideoPlayer from "@/components/VideoPlayer";
import { Sparkles, Scissors, Palette, FileText, Share2, ArrowLeft, Copy, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Studio() {
  const { id } = useParams();
  const { authHeader, API } = useAuth();
  const [video, setVideo] = useState(null);
  const [transcript, setTranscript] = useState(null); // {status, text, segments}
  const [tab, setTab] = useState("transcript");
  const [brand, setBrand] = useState({ color: "#FF6B6B", logo_text: "Looma" });
  const playerSeekRef = useRef(null);
  const nav = useNavigate();
  const BACKEND = process.env.REACT_APP_BACKEND_URL;

  const load = useCallback(() => {
    axios.get(`${API}/videos/${id}`, { headers: authHeader() })
      .then(r => setVideo(r.data))
      .catch(() => { toast.error("Video not found"); nav("/app/library"); });
    axios.get(`${API}/videos/${id}/transcript`, { headers: authHeader() })
      .then(r => setTranscript(r.data)).catch(()=>{});
    axios.get(`${API}/brand`, { headers: authHeader() })
      .then(r => setBrand(b => ({ ...b, ...r.data }))).catch(()=>{});
  }, [id, API, authHeader, nav]);

  useEffect(() => { load(); }, [load]);

  // Poll transcript while pending
  useEffect(() => {
    if (!video) return;
    if (video.transcript_status !== "pending") return;
    const it = setInterval(load, 5000);
    return () => clearInterval(it);
  }, [video, load]);

  const retranscribe = async () => {
    try {
      await axios.post(`${API}/videos/${id}/transcribe`, {}, { headers: authHeader() });
      toast.info("Transcription queued");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Cannot transcribe (no uploaded file)");
    }
  };

  if (!video) return <div className="p-10 font-heading text-xl">Loading studio…</div>;

  const playableSrc = video.url?.startsWith("/api/") ? `${BACKEND}${video.url}` : video.url;
  const embedCode = `<iframe src="${window.location.origin}/embed/${video.id}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`;
  const shareUrl = `${window.location.origin}/v/${video.id}`;
  const copyEmbed = () => { navigator.clipboard.writeText(embedCode); toast.success("Embed code copied!"); };
  const copyShare = () => { navigator.clipboard.writeText(shareUrl); toast.success("Share link copied!"); };

  const tabs = [
    { id: "transcript", icon: FileText, label: "Transcript" },
    { id: "remix", icon: Scissors, label: "Remix" },
    { id: "brand", icon: Palette, label: "Brand" },
    { id: "share", icon: Share2, label: "Share" },
  ];

  const statusBadge = {
    none:   { txt: "No transcript", bg: "bg-white" },
    pending:{ txt: "Generating…",   bg: "bg-gold" },
    ready:  { txt: "Ready",         bg: "bg-mint" },
    error:  { txt: "Failed",        bg: "bg-coral text-white" },
  }[transcript?.status || video.transcript_status || "none"];

  return (
    <div className="p-6 md:p-8 max-w-[1400px]">
      <button onClick={()=>nav("/app/library")} className="text-sm font-bold mb-4 flex items-center gap-1.5 hover:text-coral"><ArrowLeft size={16}/> Back to library</button>
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <div className="font-hand text-xl text-coral">studio</div>
          <h1 className="font-heading text-3xl truncate max-w-xl">{video.title}</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-ink/70">{video.views} views · {video.plays} plays</span>
          <span className={`nb-border ${statusBadge.bg} font-heading text-xs px-3 py-1 rounded-full flex items-center gap-1.5`}>
            {transcript?.status === "pending" && <Loader2 size={12} className="animate-spin"/>}
            {statusBadge.txt}
          </span>
          <button className="nb-btn nb-btn-gold text-sm py-2.5 px-5"><Sparkles size={16}/> Publish</button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VideoPlayer
            src={playableSrc}
            videoId={video.id}
            brandColor={brand.color}
            logoText={brand.logo_text || "Looma"}
            thumbnail={video.thumbnail || brand.default_thumbnail}
          />
        </div>
        <div className="nb-card p-0 overflow-hidden">
          <div className="flex border-b-2 border-ink bg-cream">
            {tabs.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} data-testid={`studio-tab-${t.id}`}
                className={`flex-1 py-3 px-2 font-heading text-sm font-bold flex items-center justify-center gap-1.5 ${tab===t.id ? 'bg-white text-ink' : 'text-ink/60 hover:bg-white/60'}`}>
                <t.icon size={15}/> {t.label}
              </button>
            ))}
          </div>
          <div className="p-5 max-h-[480px] overflow-y-auto scrollbar-thin">
            {tab === "transcript" && (
              <div className="space-y-2">
                {transcript?.status === "pending" && (
                  <div className="text-center py-6">
                    <Loader2 size={32} className="animate-spin mx-auto mb-2 text-coral"/>
                    <p className="text-sm text-ink/70">Generating transcript with Whisper…</p>
                  </div>
                )}
                {transcript?.status === "error" && (
                  <div className="text-center py-4">
                    <p className="text-sm text-ink/80 mb-3">Transcription failed.</p>
                    <button onClick={retranscribe} className="nb-btn text-sm py-2 px-4"><RefreshCw size={14}/> Retry</button>
                  </div>
                )}
                {(transcript?.status === "none" || !transcript) && (
                  <div className="text-center py-4">
                    <p className="text-sm text-ink/80 mb-3">No transcript yet.</p>
                    {video.storage_path
                      ? <button onClick={retranscribe} className="nb-btn text-sm py-2 px-4"><Sparkles size={14}/> Generate</button>
                      : <p className="text-xs text-ink/60">Transcript only available for videos uploaded to Looma.</p>}
                  </div>
                )}
                {transcript?.status === "ready" && transcript.segments?.length > 0 && (
                  <>
                    {transcript.segments.map((l, i) => (
                      <button key={`seg-${l.start}-${i}`} onClick={()=>{
                        const el = document.querySelector("[data-testid='video-player'] video");
                        if (el) el.currentTime = l.start;
                      }} className="flex gap-3 px-2 py-2 rounded-lg hover:bg-gold/30 cursor-pointer text-left w-full">
                        <span className="font-bold text-coral text-xs w-12 shrink-0 pt-0.5">{Math.floor(l.start/60)}:{Math.floor(l.start%60).toString().padStart(2,"0")}</span>
                        <p className="text-ink/90 text-sm leading-relaxed">{l.text}</p>
                      </button>
                    ))}
                    <button onClick={retranscribe} className="nb-btn nb-btn-ghost text-xs py-1.5 px-3 mt-4"><RefreshCw size={12}/> Re-transcribe</button>
                  </>
                )}
                {transcript?.status === "ready" && transcript.segments?.length === 0 && transcript.text && (
                  <p className="text-sm text-ink/80">{transcript.text}</p>
                )}
              </div>
            )}
            {tab === "remix" && (
              <div className="space-y-3">
                <p className="text-sm text-ink/70 mb-2">Suggested clips for social:</p>
                {(transcript?.segments?.slice(0, 4) || []).map((s, i) => (
                  <div key={`clip-${s.start}-${i}`} className="nb-border rounded-xl p-3 bg-mint">
                    <div className="font-heading text-sm">{s.text.slice(0, 40)}…</div>
                    <div className="text-xs text-ink/70 mb-2">{Math.floor(s.start)}s – {Math.floor(s.end)}s</div>
                    <button className="nb-btn text-xs py-1.5 px-3">Export clip</button>
                  </div>
                ))}
                {!transcript?.segments?.length && <p className="text-sm text-ink/60">Clip suggestions appear after transcription.</p>}
              </div>
            )}
            {tab === "brand" && (
              <div className="space-y-3">
                <p className="text-sm text-ink/70">Override brand defaults for this video.</p>
                <div>
                  <label className="font-heading text-xs mb-1.5 block">Player color</label>
                  <div className="flex gap-2 flex-wrap">
                    {["#FF6B6B","#1D1A3F","#98D8C8","#F4D068"].map(c => (
                      <button key={c} className="w-10 h-10 rounded-xl nb-border" style={{background:c}}/>
                    ))}
                  </div>
                </div>
                <button className="nb-btn nb-btn-mint w-full text-sm">Save brand</button>
              </div>
            )}
            {tab === "share" && (
              <div className="space-y-3">
                <div>
                  <label className="font-heading text-xs mb-1.5 block">Share link</label>
                  <input readOnly className="nb-input text-xs" value={shareUrl}/>
                  <button onClick={copyShare} className="nb-btn nb-btn-mint w-full mt-2 text-sm" data-testid="studio-copy-share"><Copy size={14}/> Copy share link</button>
                </div>
                <div>
                  <label className="font-heading text-xs mb-1.5 block">Embed code</label>
                  <textarea readOnly className="nb-input font-mono text-xs h-24 resize-none" value={embedCode}/>
                  <button onClick={copyEmbed} className="nb-btn w-full mt-2 text-sm" data-testid="studio-copy-embed"><Copy size={14}/> Copy embed</button>
                </div>
                <div>
                  <label className="font-heading text-xs mb-1.5 block">Direct video URL</label>
                  <input readOnly className="nb-input text-xs" value={playableSrc || ""}/>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
