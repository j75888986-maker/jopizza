import { useState } from "react";
import { X, Camera, Monitor, Layers, Upload, Play, Square, Download, RotateCcw, Mic, MicOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useMediaRecorder } from "@/hooks/useMediaRecorder";

/**
 * Multi-step recorder modal. Recording state machine lives in useMediaRecorder hook.
 * Steps: setup → recording → preview → uploading.
 */
export default function RecordModal({ onClose }) {
  const { API } = useAuth();
  const nav = useNavigate();

  const [mode, setMode] = useState("webcam");
  const [withMic, setWithMic] = useState(true);
  const [title, setTitle] = useState(`Looma — ${new Date().toLocaleString()}`);
  const [uploadPct, setUploadPct] = useState(0);
  const [step, setStep] = useState("setup");

  const rec = useMediaRecorder();
  // Recorder transitions: setup → recording (start) → preview (after stop, blob ready) → uploading
  const goStart = async () => {
    try {
      await rec.start({ mode, withMic });
      setStep("recording");
    } catch { /* error already in rec.error */ }
  };
  const goStop = () => { rec.stop(); setStep("preview"); };
  const goRedo = () => { rec.discard(); setStep("setup"); };

  const downloadLocal = () => {
    if (!rec.blob) return;
    const a = document.createElement("a");
    a.href = rec.blobUrl;
    a.download = `${title.replace(/[^a-z0-9-_ ]/gi, "_")}.webm`;
    a.click();
    toast.success("Saved to your computer");
  };

  const uploadToLooma = async () => {
    if (!rec.blob) return;
    setStep("uploading"); setUploadPct(0);
    try {
      const fd = new FormData();
      fd.append("file", rec.blob, "recording.webm");
      fd.append("title", title);
      fd.append("description", `Recorded via ${mode}`);
      fd.append("folder", "Recordings");
      fd.append("duration", String(rec.elapsed));
      const r = await axios.post(`${API}/videos/upload`, fd, {
        onUploadProgress: (e) => { if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100)); },
      });
      toast.success("Uploaded! Transcript is being generated…");
      onClose();
      nav(`/app/studio/${r.data.id}`);
    } catch (e) {
      console.error("upload", e);
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
            <h2 className="font-heading text-3xl">
              {{ setup: "Start a new recording", recording: "Recording in progress",
                 preview: "Preview your video", uploading: "Uploading to Looma" }[step]}
            </h2>
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
            {rec.error && <div className="mt-4 p-3 rounded-xl bg-coral/15 nb-border text-sm">{rec.error}</div>}
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="nb-btn nb-btn-ghost flex-1">Cancel</button>
              <button onClick={goStart} className="nb-btn flex-1" data-testid="rec-start">
                <Play size={16} fill="white"/> Start recording
              </button>
            </div>
          </>
        )}

        {step === "recording" && (
          <>
            <div className="relative rounded-2xl overflow-hidden nb-border bg-ink mb-4 aspect-video">
              <video ref={rec.livePreviewRef} className="w-full h-full object-contain" autoPlay muted playsInline/>
              <div className="absolute top-3 left-3 bg-coral text-white nb-border px-3 py-1 rounded-full font-heading text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"/> REC {fmt(rec.elapsed)}
              </div>
            </div>
            <button onClick={goStop} className="nb-btn nb-btn-dark w-full" data-testid="rec-stop">
              <Square size={16} fill="white"/> Stop & preview
            </button>
          </>
        )}

        {step === "preview" && rec.blobUrl && (
          <>
            <video src={rec.blobUrl} controls className="w-full rounded-2xl nb-border bg-ink mb-4 aspect-video"/>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={goRedo} className="nb-btn nb-btn-ghost" data-testid="rec-discard"><RotateCcw size={16}/> Redo</button>
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
