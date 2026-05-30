import { Play, Pause, Volume2, VolumeX, Maximize, RotateCcw } from "lucide-react";
import { useVideoPlayer, fmtTime } from "@/hooks/useVideoPlayer";

/**
 * Wistia-style custom video player. State + segment-tracking logic lives in useVideoPlayer.
 * This component is just the visual shell.
 */
export default function VideoPlayer({ src, videoId, brandColor = "#FF6B6B", logoText = "Looma", thumbnail = "" }) {
  const {
    ref, playing, progress, duration, muted, heatmap,
    onLoadedMetadata, onTimeUpdate, toggle, seek, reset, toggleMute, requestFullscreen,
  } = useVideoPlayer({ videoId });

  const bucketCount = Math.max(20, Math.min(80, Math.ceil((duration || 200) / 5)));
  const displayHeatmap = Array.from({ length: bucketCount }, (_, i) =>
    heatmap.find(h => h.index === i)?.intensity ?? 0.08
  );

  return (
    <div className="relative w-full aspect-video bg-ink rounded-2xl nb-border nb-shadow-lg overflow-hidden group" data-testid="video-player">
      <video ref={ref} src={src} poster={thumbnail || undefined}
        className="w-full h-full object-contain bg-black"
        onLoadedMetadata={onLoadedMetadata} onTimeUpdate={onTimeUpdate}
        onClick={toggle} playsInline crossOrigin="anonymous"/>

      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full nb-border text-sm font-heading font-black flex items-center gap-1.5" data-testid="player-brand">
        <span className="w-2 h-2 rounded-full" style={{ background: brandColor }}/>{logoText}
      </div>

      {!playing && (
        <button onClick={toggle} aria-label="Play" data-testid="player-play-overlay"
          className="absolute inset-0 m-auto w-20 h-20 rounded-full nb-border text-white flex items-center justify-center shadow-[6px_6px_0_0_rgba(0,0,0,0.6)] transition-transform hover:scale-110"
          style={{ background: brandColor }}>
          <Play size={32} fill="white" />
        </button>
      )}

      <div className={`absolute bottom-0 left-0 right-0 p-3 transition-opacity opacity-0 group-hover:opacity-100 ${!playing ? 'opacity-100' : ''} bg-gradient-to-t from-black/80 to-transparent`}>
        <div className="flex items-end gap-[2px] h-6 mb-1 px-1" title="Engagement heatmap">
          {displayHeatmap.map((h, i) => (
            <div key={`seg-${i}`} className="flex-1 rounded-sm"
              style={{ height: `${Math.max(h * 100, 8)}%`, background: `hsla(168, 47%, 72%, ${0.35 + h*0.6})` }}/>
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
            <button onClick={reset} className="p-2 rounded-full hover:bg-white/15"><RotateCcw size={16}/></button>
            <button onClick={toggleMute} className="p-2 rounded-full hover:bg-white/15">{muted ? <VolumeX size={16}/> : <Volume2 size={16}/>}</button>
            <span className="ml-2">{fmtTime((progress/100) * duration)} / {fmtTime(duration)}</span>
          </div>
          <button onClick={requestFullscreen} className="p-2 rounded-full hover:bg-white/15"><Maximize size={16}/></button>
        </div>
      </div>
    </div>
  );
}
