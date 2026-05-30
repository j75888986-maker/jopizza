import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import axios from "axios";
import { toast } from "sonner";
import { Radio, Square, Copy, ArrowLeft, Users, Sparkles, CheckCircle2, Camera, Monitor, Layers } from "lucide-react";

const CHUNK_DURATION_MS = 6000;

/**
 * Webinar host studio — supports webcam / screen / both (PiP) live broadcasting.
 * MediaRecorder restarts every CHUNK_DURATION_MS to produce a playable per-chunk webm.
 */
export default function WebinarHost() {
  const { id } = useParams();
  const { authHeader, API } = useAuth();
  const nav = useNavigate();
  const [w, setW] = useState(null);
  const [mode, setMode] = useState("webcam"); // webcam | screen | both
  const previewRef = useRef(null);
  const streamRef = useRef(null);          // stream we record from
  const screenStreamRef = useRef(null);
  const camStreamRef = useRef(null);
  const composeStop = useRef(false);
  const recorderRef = useRef(null);
  const seqRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef(null);
  const [uploadCount, setUploadCount] = useState(0);
  const [starting, setStarting] = useState(false);

  const load = () => axios.get(`${API}/webinars/${id}`, { headers: authHeader() }).then(r=>setW(r.data)).catch(()=>{ toast.error("Webinar not found"); nav("/app/webinars"); });
  useEffect(() => { load(); }, [id]);  // eslint-disable-line
  useEffect(() => () => stopAll(), []);  // eslint-disable-line

  const stopAll = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch {}
    }
    composeStop.current = true;
    [streamRef.current, screenStreamRef.current, camStreamRef.current].forEach(s => s?.getTracks().forEach(t => t.stop()));
    streamRef.current = screenStreamRef.current = camStreamRef.current = null;
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

  const buildStream = async () => {
    if (mode === "webcam") {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
      camStreamRef.current = s;
      return s;
    }
    if (mode === "screen") {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
      screenStreamRef.current = s;
      // attach mic
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getAudioTracks().forEach(t => s.addTrack(t));
      } catch { /* mic optional */ }
      return s;
    }
    // both: canvas-composited PiP
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true });
    const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: true });
    screenStreamRef.current = screen; camStreamRef.current = cam;

    const sVid = document.createElement("video"); sVid.srcObject = screen; sVid.muted = true; await sVid.play();
    const cVid = document.createElement("video"); cVid.srcObject = cam; cVid.muted = true; await cVid.play();
    const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext("2d");
    composeStop.current = false;
    const draw = () => {
      if (composeStop.current) return;
      ctx.drawImage(sVid, 0, 0, canvas.width, canvas.height);
      const cw = 280, ch = 210, pad = 24;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(canvas.width - cw - pad, canvas.height - ch - pad, cw, ch, 16);
      ctx.clip();
      ctx.drawImage(cVid, canvas.width - cw - pad, canvas.height - ch - pad, cw, ch);
      ctx.restore();
      ctx.lineWidth = 4; ctx.strokeStyle = "#FF6B6B";
      ctx.beginPath();
      ctx.roundRect(canvas.width - cw - pad, canvas.height - ch - pad, cw, ch, 16);
      ctx.stroke();
      requestAnimationFrame(draw);
    };
    draw();
    const canvasStream = canvas.captureStream(30);
    const audioTracks = [...cam.getAudioTracks(), ...screen.getAudioTracks()];
    audioTracks.forEach(t => canvasStream.addTrack(t));
    return canvasStream;
  };

  const goLive = async () => {
    setStarting(true);
    try {
      const stream = await buildStream();
      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        previewRef.current.muted = true;
        await previewRef.current.play().catch(()=>{});
      }
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : "video/webm";
      seqRef.current = 0;

      const startChunkRecorder = () => {
        if (!streamRef.current) return;
        const rec = new MediaRecorder(streamRef.current, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
        let chunks = [];
        rec.ondataavailable = (e) => { if (e.data?.size > 0) chunks.push(e.data); };
        rec.onstop = () => {
          if (chunks.length) {
            const blob = new Blob(chunks, { type: mime });
            uploadChunk(blob, seqRef.current++);
          }
          if (streamRef.current) startChunkRecorder();
        };
        rec.start();
        recorderRef.current = rec;
        setTimeout(() => { if (rec.state !== "inactive") { try { rec.stop(); } catch {} } }, CHUNK_DURATION_MS);
      };

      setW(prev => prev ? { ...prev, status: "live" } : prev);
      startChunkRecorder();
      timer.current = setInterval(() => setElapsed(e => e + 1), 1000);
      toast.success("You're live! Share your registration link.");
    } catch (e) {
      console.error(e);
      toast.error(e?.name === "NotAllowedError" ? "Permission denied — grant camera/screen access." : "Couldn't start the stream");
      stopAll();
    } finally { setStarting(false); }
  };

  const endLive = async () => {
    stopAll();
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

  const modes = [
    { id: "webcam", icon: Camera, label: "Webcam", desc: "Just your face" },
    { id: "screen", icon: Monitor, label: "Screen", desc: "Share a window" },
    { id: "both", icon: Layers, label: "Both", desc: "Picture-in-picture" },
  ];

  return (
    <div className="p-6 md:p-8 max-w-5xl">
      <button onClick={()=>nav("/app/webinars")} className="text-sm font-bold mb-4 flex items-center gap-1.5 hover:text-coral"><ArrowLeft size={16}/> Back to webinars</button>
      <div className="flex justify-between items-start mb-5 flex-wrap gap-3">
        <div>
          <div className="font-hand text-xl text-coral">host studio</div>
          <h1 className="font-heading text-3xl">{w.title}</h1>
        </div>
        {w.status === "scheduled" && <button onClick={goLive} disabled={starting} className="nb-btn" data-testid="webinar-golive"><Radio size={16}/> {starting ? "Starting…" : "Go live"}</button>}
        {w.status === "live" && <button onClick={endLive} className="nb-btn nb-btn-dark" data-testid="webinar-end"><Square size={16} fill="white"/> End webinar</button>}
        {w.status === "ended" && <span className="nb-border bg-mint rounded-full px-4 py-2 font-heading text-sm flex items-center gap-1.5"><CheckCircle2 size={14}/> Ended</span>}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          {w.status === "scheduled" && (
            <div className="nb-card">
              <h3 className="font-heading text-lg mb-3">Broadcast mode</h3>
              <div className="grid grid-cols-3 gap-3">
                {modes.map(m => (
                  <button key={m.id} onClick={()=>setMode(m.id)} data-testid={`webinar-mode-${m.id}`}
                    className={`p-4 rounded-2xl nb-border text-left transition ${mode===m.id ? 'bg-coral text-white nb-shadow-sm' : 'bg-white hover:bg-mint'}`}>
                    <m.icon size={22} strokeWidth={2.5} className="mb-2"/>
                    <div className="font-heading text-sm">{m.label}</div>
                    <div className="text-xs opacity-80">{m.desc}</div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-ink/60 mt-3">When you go live, your browser will ask for camera/screen permission accordingly.</p>
            </div>
          )}
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
                <p className="text-white/70 text-sm max-w-md">Click <b>Go live</b> to start streaming as <b>{modes.find(m=>m.id===mode)?.label}</b>.</p>
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
        </div>
      </div>
    </div>
  );
}
