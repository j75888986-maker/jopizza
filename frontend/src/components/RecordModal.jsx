import { useState, useRef, useEffect } from "react";
import { X, Camera, Monitor, Layers, Upload, Play, Square, Pause, Download, RotateCcw, Mic, MicOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import axios from "axios";
import { useNavigate } from "react-router-dom";

/**
 * RecordModal — captures webcam/screen/both via MediaRecorder,
 * shows preview, saves to user's computer (download), uploads to Looma + auto-transcribe.
 */
export default function RecordModal({ onClose }) {
  const { authHeader, API } = useAuth();
  const nav = useNavigate();

  const [step, setStep] = useState("setup"); // setup | recording | preview | uploading
  const [mode, setMode] = useState("webcam");
  const [withMic, setWithMic] = useState(true);
  const [title, setTitle] = useState(`Looma — ${new Date().toLocaleString()}`);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState("");

  const livePreview = useRef(null);
  const playback = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const stream = useRef(null);
  const screenStream = useRef(null);
  const camStream = useRef(null);
  const composeCanvas = useRef(null);
  const composeStop = useRef(false);
  const timer = useRef(null);

  useEffect(() => () => { stopAllStreams(); if (timer.current) clearInterval(timer.current); if (blobUrl) URL.revokeObjectURL(blobUrl); }, []); // eslint-disable-line

  const stopAllStreams = () => {
    [stream.current, screenStream.current, camStream.current].forEach(s => s?.getTracks().forEach(t=>t.stop()));
    stream.current = screenStream.current = camStream.current = null;
    composeStop.current = true;
  };

  const startRecording = async () => {
    setError("");
    try {
      let recordStream = null;
      const audio = withMic;

      if (mode === "webcam") {
        recordStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio });
        camStream.current = recordStream;
      } else if (mode === "screen") {
        recordStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio });
        screenStream.current = recordStream;
        if (audio) {
          try {
            const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
            mic.getAudioTracks().forEach(t => recordStream.addTrack(t));
          } catch { /* mic optional */ }
        }
      } else {
        // both: screen + webcam picture-in-picture composite via canvas
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio });
        const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio });
        screenStream.current = screen; camStream.current = cam;

        const sVideo = document.createElement("video");
        sVideo.srcObject = screen; sVideo.muted = true; await sVideo.play();
        const cVideo = document.createElement("video");
        cVideo.srcObject = cam; cVideo.muted = true; await cVideo.play();

        const canvas = document.createElement("canvas");
        canvas.width = 1280; canvas.height = 720;
        composeCanvas.current = canvas;
        const ctx = canvas.getContext("2d");
        composeStop.current = false;
        const draw = () => {
          if (composeStop.current) return;
          ctx.drawImage(sVideo, 0, 0, canvas.width, canvas.height);
          const cw = 280, ch = 210, pad = 24;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(canvas.width - cw - pad, canvas.height - ch - pad, cw, ch, 16);
          ctx.clip();
          ctx.drawImage(cVideo, canvas.width - cw - pad, canvas.height - ch - pad, cw, ch);
          ctx.restore();
          ctx.lineWidth = 4; ctx.strokeStyle = "#FF6B6B";
          ctx.beginPath();
          ctx.roundRect(canvas.width - cw - pad, canvas.height - ch - pad, cw, ch, 16);
          ctx.stroke();
          requestAnimationFrame(draw);
        };
        draw();
        const canvasStream = canvas.captureStream(30);
        // combine audio tracks (mic + system if present)
        const audioTracks = [...cam.getAudioTracks(), ...screen.getAudioTracks()];
        audioTracks.forEach(t => canvasStream.addTrack(t));
        recordStream = canvasStream;
      }

      stream.current = recordStream;
      if (livePreview.current) {
        livePreview.current.srcObject = mode === "both" && composeCanvas.current ? composeCanvas.current.captureStream() : recordStream;
        livePreview.current.muted = true;
        await livePreview.current.play().catch(()=>{});
      }

      chunks.current = [];
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus"
                : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus"
                : "video/webm";
      const rec = new MediaRecorder(recordStream, { mimeType: mime, videoBitsPerSecond: 2_500_000 });
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunks.current, { type: mime });
        setBlob(b);
        const url = URL.createObjectURL(b);
        setBlobUrl(url);
        setStep("preview");
        stopAllStreams();
      };
      rec.start(1000);
      recorder.current = rec;
      setStep("recording"); setElapsed(0);
      timer.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (e) {
      console.error(e);
      setError(e?.message || "Could not access camera/screen. Please grant permission.");
      stopAllStreams();
    }
  };

  const stopRecording = () => {
    if (recorder.current?.state !== "inactive") recorder.current?.stop();
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  };

  const discard = () => {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlob(null); setBlobUrl(null); setStep("setup"); setElapsed(0); setUploadPct(0);
  };

  const downloadLocal = () => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${title.replace(/[^a-z0-9-_ ]/gi, "_")}.webm`;
    a.click();
    toast.success("Saved to your computer");
  };

  const uploadToLooma = async () => {
    if (!blob) return;
    setStep("uploading"); setUploadPct(0);
    try {
      const fd = new FormData();
      fd.append("file", blob, "recording.webm");
      fd.append("title", title);
      fd.append("description", `Recorded via ${mode}`);
      fd.append("folder", "Recordings");
      fd.append("duration", String(elapsed));
      const r = await axios.post(`${API}/videos/upload`, fd, {
        headers: { ...authHeader() },
        onUploadProgress: (e) => { if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100)); },
      });
      toast.success("Uploaded! Transcript is being generated…");
      onClose();
      nav(`/app/studio/${r.data.id}`);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.detail || "Upload failed");
      setStep("preview");
    }
  };

  const fmt = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`;

  const modes = [
    { id: "webcam", icon: Camera, label: "Webcam", desc: "Just your face" },
    { id: "screen", icon: Monitor, label: "Screen", desc: "Share a window" },
    { id: "both", icon: Layers, label: "Both", desc: "Picture-in-picture" },
  ];

  return (
    <div className="fixed inset-0 bg-ink/70 z-50 flex items-center justify-center p-4" onClick={step==="recording" ? undefined : onClose}>
      <div className="bg-cream nb-border rounded-3xl nb-shadow-lg max-w-3xl w-full p-7 max-h-[92vh] overflow-y-auto scrollbar-thin" onClick={e=>e.stopPropagation()} data-testid="record-modal">
        <div className="flex justify-between items-start mb-5">
          <div>
            <div className="font-hand text-2xl text-coral">record a test one now</div>
            <h2 className="font-heading text-3xl">{ {setup:"Start a new recording", recording:"Recording in progress", preview:"Preview your video", uploading:"Uploading to Looma"}[step]}</h2>
          </div>
          {step !== "recording" && step !== "uploading" && (
            <button onClick={onClose} className="p-2 rounded-xl nb-border bg-white" data-testid="rec-close"><X size={18}/></button>
          )}
        </div>

        {step === "setup" && (
          <>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {modes.map(m => (
                <button key={m.id} onClick={()=>setMode(m.id)} data-testid={`rec-mode-${m.id}`}
                  className={`p-4 rounded-2xl nb-border text-left transition ${mode===m.id ? 'bg-coral text-white nb-shadow-sm' : 'bg-white hover:bg-mint'}`}>
                  <m.icon size={22} strokeWidth={2.5} className="mb-2"/>
                  <div className="font-heading text-sm">{m.label}</div>
                  <div className="text-xs opacity-80">{m.desc}</div>
                </button>
              ))}
            </div>
            <div className="space-y-4">
              <div>
                <label className="font-heading text-sm mb-1.5 block">Title</label>
                <input className="nb-input" value={title} onChange={e=>setTitle(e.target.value)} data-testid="rec-title"/>
              </div>
              <label className="flex items-center gap-3 p-3 nb-border rounded-xl bg-white cursor-pointer">
                <input type="checkbox" checked={withMic} onChange={e=>setWithMic(e.target.checked)} className="w-5 h-5"/>
                {withMic ? <Mic size={20}/> : <MicOff size={20}/>}
                <span className="font-bold flex-1">Record microphone audio</span>
              </label>
            </div>
            {error && <div className="mt-4 p-3 rounded-xl bg-coral/15 nb-border text-sm">{error}</div>}
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="nb-btn nb-btn-ghost flex-1">Cancel</button>
              <button onClick={startRecording} className="nb-btn flex-1" data-testid="rec-start">
                <Play size={16} fill="white"/> Start recording
              </button>
            </div>
          </>
        )}

        {step === "recording" && (
          <>
            <div className="relative rounded-2xl overflow-hidden nb-border bg-ink mb-4 aspect-video">
              <video ref={livePreview} className="w-full h-full object-contain" autoPlay muted playsInline/>
              <div className="absolute top-3 left-3 bg-coral text-white nb-border px-3 py-1 rounded-full font-heading text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"/> REC {fmt(elapsed)}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={stopRecording} className="nb-btn nb-btn-dark flex-1" data-testid="rec-stop">
                <Square size={16} fill="white"/> Stop & preview
              </button>
            </div>
          </>
        )}

        {step === "preview" && blobUrl && (
          <>
            <video ref={playback} src={blobUrl} controls className="w-full rounded-2xl nb-border bg-ink mb-4 aspect-video"/>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={discard} className="nb-btn nb-btn-ghost" data-testid="rec-discard"><RotateCcw size={16}/> Redo</button>
              <button onClick={downloadLocal} className="nb-btn nb-btn-gold" data-testid="rec-download"><Download size={16}/> Save local</button>
              <button onClick={uploadToLooma} className="nb-btn" data-testid="rec-upload"><Upload size={16}/> Upload</button>
            </div>
            <p className="text-xs text-ink/60 mt-3 text-center">Upload kicks off automatic AI transcription. Files larger than 25MB skip transcription.</p>
          </>
        )}

        {step === "uploading" && (
          <div className="py-10 text-center">
            <div className="font-heading text-xl mb-4">Uploading to Looma…</div>
            <div className="w-full h-4 rounded-full nb-border bg-white overflow-hidden">
              <div className="h-full bg-coral transition-all" style={{ width: `${uploadPct}%` }}/>
            </div>
            <div className="mt-2 text-sm">{uploadPct}%</div>
          </div>
        )}
      </div>
    </div>
  );
}
