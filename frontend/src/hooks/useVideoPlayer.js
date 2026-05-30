// Shared player hook used by VideoPlayer (dashboard studio) and PublicViewer (/v/:id, /embed/:id).
// Encapsulates: play/pause state, progress, duration, mute, scrub, segment tracking (watch/skip/rewatch),
// one-time view tracking, and heatmap fetching.
import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function useVideoPlayer({ videoId, autoHeatmap = true }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [heatmap, setHeatmap] = useState([]);

  const tracked = useRef(false);
  const sentSegs = useRef(new Set());
  const lastSeg = useRef(-1);
  const sessionId = useRef(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  );

  const reloadHeatmap = useCallback(() => {
    if (!videoId || !autoHeatmap) return;
    axios.get(`${API}/videos/${videoId}/heatmap`)
      .then(r => setHeatmap(r.data.segments || []))
      .catch(() => {});
  }, [videoId, autoHeatmap]);

  useEffect(() => { reloadHeatmap(); }, [reloadHeatmap]);

  const trackSeg = useCallback((seg, action) => {
    if (!videoId || seg < 0) return;
    if (action === "watch" && sentSegs.current.has(seg)) return;
    if (action === "watch") sentSegs.current.add(seg);
    axios.post(`${API}/videos/${videoId}/segment`, {
      video_id: videoId, session_id: sessionId.current, segment_index: seg, action,
    }).catch(() => {});
  }, [videoId]);

  const onLoadedMetadata = useCallback(() => {
    setDuration(ref.current?.duration || 0);
  }, []);

  const onTimeUpdate = useCallback(() => {
    if (!ref.current) return;
    const t = ref.current.currentTime;
    const d = ref.current.duration || 1;
    setProgress((t / d) * 100);
    const seg = Math.floor(t / 5);
    if (seg !== lastSeg.current) {
      if (seg < lastSeg.current && sentSegs.current.has(seg)) trackSeg(seg, "rewatch");
      else if (!sentSegs.current.has(seg)) trackSeg(seg, "watch");
      if (lastSeg.current >= 0 && seg > lastSeg.current + 1) trackSeg(lastSeg.current + 1, "skip");
      lastSeg.current = seg;
    }
  }, [trackSeg]);

  const toggle = useCallback(() => {
    if (!ref.current) return;
    if (ref.current.paused) {
      ref.current.play();
      if (!tracked.current && videoId) {
        axios.post(`${API}/videos/${videoId}/view`).catch(() => {});
        tracked.current = true;
      }
    } else ref.current.pause();
  }, [videoId]);

  const seek = useCallback((e) => {
    if (!ref.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    ref.current.currentTime = pct * (ref.current.duration || 0);
  }, []);

  const reset = useCallback(() => {
    if (ref.current) ref.current.currentTime = 0;
  }, []);

  const toggleMute = useCallback(() => {
    setMuted(m => {
      if (ref.current) ref.current.muted = !m;
      return !m;
    });
  }, []);

  const requestFullscreen = useCallback(() => {
    ref.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const v = ref.current; if (!v) return;
    const p = () => setPlaying(true);
    const pz = () => setPlaying(false);
    const ended = () => reloadHeatmap();
    v.addEventListener("play", p);
    v.addEventListener("pause", pz);
    v.addEventListener("ended", ended);
    return () => {
      v.removeEventListener("play", p);
      v.removeEventListener("pause", pz);
      v.removeEventListener("ended", ended);
    };
  }, [reloadHeatmap]);

  return {
    ref, playing, progress, duration, muted, heatmap,
    onLoadedMetadata, onTimeUpdate,
    toggle, seek, reset, toggleMute, requestFullscreen,
  };
}

export const fmtTime = (s) => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};
