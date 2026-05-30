import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Calendar, Users, Play, CheckCircle2, Radio } from "lucide-react";
import { Star, Heart, Sparkle, Blob } from "@/components/Doodles";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND = process.env.REACT_APP_BACKEND_URL;

/**
 * Public webinar landing page:
 * - status=scheduled: registration form
 * - status=live: shows latest streamed chunk, polls /public/webinars/:id every 4s for new chunks
 * - status=ended: shows replay video
 */
export default function PublicWebinar() {
  const { id } = useParams();
  const [w, setW] = useState(null);
  const [err, setErr] = useState(null);
  const [recording, setRecording] = useState(null); // {url, brand, title} when ended
  const [registered, setRegistered] = useState(false);
  const [form, setForm] = useState({ email: "", name: "" });
  const [submitting, setSubmitting] = useState(false);
  const videoRef = useRef(null);
  const [currentChunkSeq, setCurrentChunkSeq] = useState(-1);

  const load = () => axios.get(`${API}/public/webinars/${id}`).then(r=>setW(r.data)).catch(e=>setErr(e?.response?.data?.detail || "Webinar not found"));
  useEffect(() => { load(); }, [id]);   // eslint-disable-line

  // When webinar enters "ended", fetch the public recording
  useEffect(() => {
    if (w?.status === "ended" && !recording) {
      axios.get(`${API}/public/webinars/${id}/recording`)
        .then(r => setRecording(r.data))
        .catch(() => setRecording({ url: null }));
    }
  }, [w?.status, id, recording]);

  // Poll while live for new chunks
  useEffect(() => {
    if (!w || w.status !== "live") return;
    const it = setInterval(load, 4000);
    return () => clearInterval(it);
  }, [w?.status]);   // eslint-disable-line

  // Auto-advance to next chunk when current ends
  useEffect(() => {
    if (!w || w.status !== "live" || !w.recording_chunks?.length) return;
    const chunks = [...w.recording_chunks].sort((a, b) => a.seq - b.seq);
    if (currentChunkSeq < 0) {
      setCurrentChunkSeq(chunks[0].seq);
    } else {
      // if new chunks arrived after current, queue them
      const v = videoRef.current;
      if (v && v.ended) {
        const next = chunks.find(c => c.seq > currentChunkSeq);
        if (next) setCurrentChunkSeq(next.seq);
      }
    }
  }, [w, currentChunkSeq]);

  const register = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      const r = await axios.post(`${API}/public/webinars/${id}/register`, form);
      setRegistered(true);
      toast.success(r.data.already_registered ? "You're already on the list!" : "You're registered!");
    } catch { toast.error("Registration failed"); }
    finally { setSubmitting(false); }
  };

  if (err) return <div className="min-h-screen flex items-center justify-center bg-cream"><div className="nb-card text-center"><h1 className="font-heading text-2xl">{err}</h1></div></div>;
  if (!w) return <div className="min-h-screen flex items-center justify-center bg-cream font-heading">Loading…</div>;

  const brandColor = w.brand?.color || "#FF6B6B";
  const chunks = (w.recording_chunks || []).sort((a, b) => a.seq - b.seq);
  const currentChunk = chunks.find(c => c.seq === currentChunkSeq);

  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-mint border-b-2 border-ink relative overflow-hidden">
        <Blob className="absolute -top-32 -right-20 w-[400px] h-[400px] opacity-40" color="#F4D068"/>
        <Star className="absolute top-8 right-12 w-12 h-12 wiggle"/>
        <Heart className="absolute bottom-6 left-12 w-10 h-10 float-fast"/>
        <Sparkle className="absolute top-12 left-1/3 w-6 h-6"/>
        <div className="relative max-w-4xl mx-auto px-6 py-12 md:py-16">
          <a href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-2xl bg-coral nb-border flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span className="font-heading text-xl">Looma</span>
          </a>
          {w.status === "live" && (
            <div className="inline-flex items-center gap-2 nb-border bg-coral text-white rounded-full px-4 py-1.5 mb-5 nb-shadow-sm font-heading">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse"/> LIVE NOW
            </div>
          )}
          {w.status === "ended" && (
            <div className="inline-flex items-center gap-2 nb-border bg-white rounded-full px-4 py-1.5 mb-5 nb-shadow-sm font-heading">
              <CheckCircle2 size={14}/> Recording available
            </div>
          )}
          <div className="font-hand text-2xl text-coral mb-2">webinar</div>
          <h1 className="font-heading text-4xl md:text-5xl mb-3">{w.title}</h1>
          {w.description && <p className="text-lg text-ink/80 max-w-2xl">{w.description}</p>}
          <div className="flex flex-wrap gap-5 mt-5 text-sm">
            {w.host_name && <span className="font-bold">Hosted by {w.host_name}</span>}
            {w.scheduled_at && <span className="flex items-center gap-1.5"><Calendar size={14}/> {new Date(w.scheduled_at).toLocaleString()}</span>}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {w.status === "live" && currentChunk && (
          <>
            <video ref={videoRef} src={`${BACKEND}${currentChunk.url}`} controls autoPlay
              className="w-full rounded-2xl nb-border nb-shadow-lg bg-ink aspect-video"
              onEnded={() => {
                const next = chunks.find(c => c.seq > currentChunkSeq);
                if (next) setCurrentChunkSeq(next.seq);
              }} data-testid="webinar-live-player"/>
            <p className="text-sm text-ink/70 mt-3 text-center font-bold">📡 Streaming live — new segments arrive every few seconds.</p>
          </>
        )}

        {w.status === "live" && !currentChunk && (
          <div className="nb-card text-center py-12">
            <Radio size={48} className="mx-auto mb-3 text-coral animate-pulse"/>
            <div className="font-heading text-xl">Webinar is going live…</div>
            <p className="text-sm text-ink/70 mt-2">First segment will appear in a moment.</p>
          </div>
        )}

        {w.status === "ended" && (
          recording?.url ? (
            <>
              <video
                src={recording.url.startsWith("/api/") ? `${BACKEND}${recording.url}` : recording.url}
                controls
                poster={recording.thumbnail || undefined}
                className="w-full rounded-2xl nb-border nb-shadow-lg bg-ink aspect-video"
                data-testid="webinar-replay-player"/>
              <p className="text-sm text-ink/70 mt-3 text-center font-bold">📼 Recording — first published {new Date(w.scheduled_at || Date.now()).toLocaleDateString()}</p>
            </>
          ) : (
            <div className="nb-card text-center py-12">
              <CheckCircle2 size={48} className="mx-auto mb-3 text-ink"/>
              <div className="font-heading text-xl">Webinar ended</div>
              <p className="text-sm text-ink/70 mt-2">{recording === null ? "Loading recording…" : "Recording is being processed."}</p>
            </div>
          )
        )}

        {w.status === "scheduled" && !registered && (
          <div className="nb-card">
            <div className="font-hand text-2xl text-coral mb-1">save your seat</div>
            <h2 className="font-heading text-2xl mb-5">Register for this webinar</h2>
            <form onSubmit={register} className="space-y-4">
              <div>
                <label className="font-heading text-sm mb-1.5 block">Name</label>
                <input required className="nb-input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} data-testid="webinar-reg-name"/>
              </div>
              <div>
                <label className="font-heading text-sm mb-1.5 block">Email</label>
                <input required type="email" className="nb-input" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} data-testid="webinar-reg-email"/>
              </div>
              <button type="submit" disabled={submitting} className="nb-btn w-full" style={{ background: brandColor, color: "white" }} data-testid="webinar-reg-submit">
                {submitting ? "Registering…" : "Save my seat"}
              </button>
              <p className="text-xs text-ink/60 text-center flex items-center justify-center gap-1.5"><Users size={12}/> {w.registrations_count} already registered</p>
            </form>
          </div>
        )}

        {w.status === "scheduled" && registered && (
          <div className="nb-card text-center py-10 bg-mint">
            <CheckCircle2 size={48} className="mx-auto mb-3 text-ink"/>
            <h2 className="font-heading text-2xl mb-1">You're in! 🎉</h2>
            <p className="text-ink/80">We'll email you a reminder before the webinar starts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
