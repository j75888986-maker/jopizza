import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Radio, Square, Copy, ArrowLeft, Users, Sparkles, CheckCircle2 } from "lucide-react";

const CHUNK_DURATION_MS = 6000;  // 6-second chunks for near-live UX

/**
 * Webinar host studio:
 * - Pre-live: shows registration link + Go Live button
 * - Live: captures webcam (could be screen too) via MediaRecorder.timeslice,
 *   uploads each chunk to /api/webinars/:id/chunk as it becomes available
 * - End: hits /api/webinars/:id/end which creates a recorded video and saves to library
 */
export default function WebinarHost() {
  const { id } = useParams();
  const { authHeader, API } = useAuth();
  const nav = useNavigate();
  const [w, setW] = useState(null);
  const previewRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const seqRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef(null);
  const [uploadCount, setUploadCount] = useState(0);

  const load = () => axios.get(`${API}/webinars/${id}`, { headers: authHeader() }).then(r=>setW(r.data)).catch(()=>{ toast.error("Webinar not found"); nav("/app/webinars"); });
  useEffect(() => { load(); }, [id]);  // eslint-disable-line
  useEffect(() => () => stopStream(), []);  // eslint-disable-line

  const stopStream = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  };

  const uploadChunk = async (blob, seq) => {
    try {
      const fd = new FormData();
      fd.append("file", blob, `chunk_${seq}.webm`);
      fd.append("seq", String(seq));
      await axios.post(`${API}/webinars/${id}/chunk`, fd, { headers: { ...authHeader() } });
      setUploadCount(c => c + 1);
    } catch (e) { console.error("chunk upload", e); }
  };

  const goLive = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 }, audio: true
      });
      streamRef.current = stream;
      if (previewRef.current) { previewRef.current.srcObject = stream; previewRef.current.muted = true; await previewRef.current.play().catch(()=>{}); }

      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/webm";
      seqRef.current = 0;

      // Use individual MediaRecorder restarts to produce playable per-chunk webms
      const startChunkRecorder = () => {
        if (!streamRef.current) return;
        const rec = new MediaRecorder(streamRef.current, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
        let chunks = [];
        rec.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
        rec.onstop = () => {
          if (chunks.length) {
            const blob = new Blob(chunks, { type: mime });
            const s = seqRef.current++;
            uploadChunk(blob, s);
          }
          if (streamRef.current) startChunkRecorder(); // start next chunk
        };
        rec.start();
        recorderRef.current = rec;
        setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, CHUNK_DURATION_MS);
      };

      // Mark webinar as live (status flips on first chunk upload, but optimistic UI)
      setW(prev => prev ? { ...prev, status: "live" } : prev);
      startChunkRecorder();
      timer.current = setInterval(() => setElapsed(e => e + 1), 1000);
      toast.success("You're live! Share your registration link.");
    } catch (e) {
      console.error(e); toast.error("Couldn't access camera/mic");
    }
  };

  const endLive = async () => {
    stopStream();
    try {
      const r = await axios.post(`${API}/webinars/${id}/end`, {}, { headers: authHeader() });
      setW(r.data);
      toast.success("Webinar ended. Recording saved to your library.");
    } catch { toast.error("Couldn't end webinar cleanly"); }
  };

  if (!w) return <div className="p-10 font-heading">Loading…</div>;

  const publicUrl = `${window.location.origin}/webinar/${w.id}`;
  const copyLink = () => { navigator.clipboard.writeText(publicUrl); toast.success("Registration link copied!"); };

  const fmt = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <button onClick={()=>nav("/app/webinars")} className="text-sm font-bold mb-4 flex items-center gap-1.5 hover:text-coral"><ArrowLeft size={16}/> Back to webinars</button>
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <div className="font-hand text-xl text-coral">host studio</div>
          <h1 className="font-heading text-3xl">{w.title}</h1>
        </div>
        {w.status === "scheduled" && <button onClick={goLive} className="nb-btn" data-testid="webinar-golive"><Radio size={16}/> Go live</button>}
        {w.status === "live" && <button onClick={endLive} className="nb-btn nb-btn-dark" data-testid="webinar-end"><Square size={16} fill="white"/> End webinar</button>}
        {w.status === "ended" && <span className="nb-border bg-mint rounded-full px-4 py-2 font-heading text-sm flex items-center gap-1.5"><CheckCircle2 size={14}/> Ended</span>}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video rounded-2xl nb-border nb-shadow-lg overflow-hidden bg-ink">
            {w.status === "live" ? (
              <>
                <video ref={previewRef} className="w-full h-full object-contain" autoPlay muted playsInline data-testid="webinar-live-preview"/>
                <div className="absolute top-3 left-3 bg-coral text-white nb-border px-3 py-1 rounded-full font-heading text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse"/> LIVE {fmt(elapsed)}
                </div>
                <div className="absolute top-3 right-3 bg-white nb-border px-3 py-1 rounded-full font-bold text-xs flex items-center gap-1.5">
                  <Sparkles size={12}/> {uploadCount} chunks streamed
                </div>
              </>
            ) : w.status === "ended" ? (
              <div className="flex flex-col items-center justify-center text-white h-full gap-3">
                <CheckCircle2 size={48}/>
                <div className="font-heading text-xl">Webinar ended</div>
                <p className="text-white/70 text-sm">The recording is in your Library under "Webinar Recordings".</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-white h-full gap-3 p-6 text-center">
                <Radio size={48}/>
                <div className="font-heading text-xl">Ready when you are</div>
                <p className="text-white/70 text-sm max-w-md">Click <b>Go live</b> to start streaming. We'll chunk your video and serve it to your attendees within seconds.</p>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <div className="nb-card">
            <h3 className="font-heading text-lg mb-2 flex items-center gap-2"><Users size={18}/> Registrations</h3>
            <div className="font-heading text-4xl">{w.registrations_count || 0}</div>
            <p className="text-sm text-ink/70">attendees signed up</p>
          </div>
          <div className="nb-card">
            <h3 className="font-heading text-lg mb-2">Public link</h3>
            <input readOnly className="nb-input text-xs" value={publicUrl}/>
            <button onClick={copyLink} className="nb-btn w-full mt-3 text-sm" data-testid="webinar-copy-link"><Copy size={14}/> Copy</button>
          </div>
          {w.status === "scheduled" && (
            <div className="nb-card bg-gold">
              <div className="font-hand text-xl">heads up</div>
              <p className="text-sm">You'll be asked for camera + mic permission when going live. Picture-in-picture screen sharing comes in v3.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
