"use client";

import { useRef, useState } from "react";
import { mediaUrl } from "@/lib/toeic";

const RATES = [0.75, 0.9, 1, 1.1, 1.25];

export default function AudioPlayer({ src, autoPlay = false }: { src: string | null; autoPlay?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState(1);
  const url = mediaUrl(src);
  if (!url) return <div className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">Câu này chưa có file audio.</div>;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 p-2">
      <audio
        key={url}
        ref={ref}
        src={url}
        controls
        preload="metadata"
        autoPlay={autoPlay}
        onLoadedMetadata={(e) => {
          e.currentTarget.playbackRate = rate;
        }}
        className="h-10 flex-1"
      />
      <select
        aria-label="Tốc độ phát"
        value={rate}
        onChange={(e) => {
          const r = Number(e.target.value);
          setRate(r);
          if (ref.current) ref.current.playbackRate = r;
        }}
        className="rounded-md border border-line bg-surface px-1.5 py-1 text-sm"
      >
        {RATES.map((r) => (
          <option key={r} value={r}>
            {r}×
          </option>
        ))}
      </select>
    </div>
  );
}
