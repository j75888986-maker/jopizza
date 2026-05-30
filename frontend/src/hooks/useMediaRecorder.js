// Shared MediaRecorder hook for RecordModal (full clip recording) and WebinarHost (chunked live).
// Encapsulates: stream acquisition (webcam/screen/both with canvas PiP), MediaRecorder lifecycle,
// elapsed timer, error handling, cleanup.
//
// Two usage shapes:
//   1. Full-clip recording: pass nothing extra. After stop(), call getBlob() / getBlobUrl().
//   2. Chunked live: pass { chunkMs, onChunk(blob, seq) }. Recorder restarts every chunkMs to emit
//      a complete per-chunk webm file, ideal for upload-as-you-go.
import { useCallback, useEffect, useRef, useState } from "react";

const PIP_BORDER_COLOR = "#FF6B6B";

async function buildStream({ mode, withMic }) {
  if (mode === "webcam") {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: 1280, height: 720 }, audio: withMic,
    });
  }
  if (mode === "screen") {
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: withMic });
    if (withMic) {
      try {
        const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
        mic.getAudioTracks().forEach(t => screen.addTrack(t));
      } catch (e) { console.debug("mic not available", e); }
    }
    return screen;
  }
  // both: canvas PiP compositing
  const screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: withMic });
  const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: withMic });

  const sVid = document.createElement("video"); sVid.srcObject = screen; sVid.muted = true; await sVid.play();
  const cVid = document.createElement("video"); cVid.srcObject = cam; cVid.muted = true; await cVid.play();
  const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 720;
  const ctx = canvas.getContext("2d");
  let stopped = false;
  const draw = () => {
    if (stopped) return;
    ctx.drawImage(sVid, 0, 0, canvas.width, canvas.height);
    const cw = 280, ch = 210, pad = 24;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(canvas.width - cw - pad, canvas.height - ch - pad, cw, ch, 16);
    ctx.clip();
    ctx.drawImage(cVid, canvas.width - cw - pad, canvas.height - ch - pad, cw, ch);
    ctx.restore();
    ctx.lineWidth = 4; ctx.strokeStyle = PIP_BORDER_COLOR;
    ctx.beginPath();
    ctx.roundRect(canvas.width - cw - pad, canvas.height - ch - pad, cw, ch, 16);
    ctx.stroke();
    requestAnimationFrame(draw);
  };
  draw();
  const canvasStream = canvas.captureStream(30);
  [...cam.getAudioTracks(), ...screen.getAudioTracks()].forEach(t => canvasStream.addTrack(t));
  canvasStream.__cleanup = () => {
    stopped = true;
    [screen, cam].forEach(s => s.getTracks().forEach(t => t.stop()));
  };
  return canvasStream;
}

function pickMime() {
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")) return "video/webm;codecs=vp9,opus";
  if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) return "video/webm;codecs=vp8,opus";
  return "video/webm";
}

export function useMediaRecorder({ chunkMs = 0, onChunk = null, bitrate = 2_500_000 } = {}) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [blob, setBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);

  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const seqRef = useRef(0);
  const livePreviewRef = useRef(null);

  const cleanup = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch (e) { console.debug("rec stop noop", e); }
    }
    recorderRef.current = null;
    const s = streamRef.current;
    if (s) {
      try { s.__cleanup?.(); } catch (e) { console.debug("stream cleanup noop", e); }
      s.getTracks().forEach(t => t.stop());
    }
    streamRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => {
    cleanup();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }, [cleanup, blobUrl]);

  const start = useCallback(async ({ mode = "webcam", withMic = true } = {}) => {
    setError("");
    setBlob(null);
    if (blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null); }
    setElapsed(0);
    seqRef.current = 0;
    try {
      const stream = await buildStream({ mode, withMic });
      streamRef.current = stream;
      if (livePreviewRef.current) {
        livePreviewRef.current.srcObject = stream;
        livePreviewRef.current.muted = true;
        await livePreviewRef.current.play().catch(e => console.debug("autoplay blocked", e));
      }
      const mime = pickMime();

      if (chunkMs > 0 && onChunk) {
        // Chunked live mode: restart MediaRecorder every chunkMs to produce playable per-chunk files
        const startChunkRec = () => {
          if (!streamRef.current) return;
          const rec = new MediaRecorder(streamRef.current, { mimeType: mime, videoBitsPerSecond: bitrate });
          const local = [];
          rec.ondataavailable = (e) => { if (e.data?.size > 0) local.push(e.data); };
          rec.onstop = () => {
            if (local.length) {
              const b = new Blob(local, { type: mime });
              const s = seqRef.current++;
              try { onChunk(b, s); } catch (e) { console.error("onChunk error", e); }
            }
            if (streamRef.current) startChunkRec();
          };
          rec.start();
          recorderRef.current = rec;
          setTimeout(() => {
            if (rec.state !== "inactive") {
              try { rec.stop(); } catch (e) { console.debug("rec stop noop", e); }
            }
          }, chunkMs);
        };
        startChunkRec();
      } else {
        // Single-blob mode
        chunksRef.current = [];
        const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
        rec.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
        rec.onstop = () => {
          const b = new Blob(chunksRef.current, { type: mime });
          setBlob(b);
          setBlobUrl(URL.createObjectURL(b));
        };
        rec.start(1000);
        recorderRef.current = rec;
      }

      setRecording(true);
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } catch (e) {
      console.error("recorder start", e);
      setError(e?.name === "NotAllowedError"
        ? "Permission denied — grant camera/screen access."
        : (e?.message || "Could not start recording"));
      cleanup();
      throw e;
    }
  }, [chunkMs, onChunk, bitrate, blobUrl, cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setRecording(false);
  }, [cleanup]);

  const discard = useCallback(() => {
    setBlob(null);
    if (blobUrl) { URL.revokeObjectURL(blobUrl); setBlobUrl(null); }
    setElapsed(0);
  }, [blobUrl]);

  return {
    recording, elapsed, error,
    blob, blobUrl,
    livePreviewRef,
    start, stop, discard,
  };
}
