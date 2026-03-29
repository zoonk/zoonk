"use client";

import { PauseIcon, Volume2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Simple audio playback button for the admin review interface.
 * Uses native Audio API — no preloading or caching needed since
 * admin reviews one item at a time.
 */
export function PlayAudioInline({ audioUrl }: { audioUrl: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(audioUrl);
      audio.addEventListener("ended", () => setIsPlaying(false));
      audioRef.current = audio;
    }

    return audioRef.current;
  }, [audioUrl]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [audioUrl],
  );

  const handleClick = () => {
    const audio = getAudio();

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      void audio.play();
      setIsPlaying(true);
    }
  };

  const Icon = isPlaying ? PauseIcon : Volume2Icon;
  const label = isPlaying ? "Pause audio" : "Play audio";

  return (
    <button
      aria-label={label}
      className="bg-primary text-primary-foreground hover:bg-primary/90 flex size-14 items-center justify-center rounded-full transition-all duration-150 hover:scale-105 active:scale-95"
      onClick={handleClick}
      type="button"
    >
      <Icon className="size-6" />
    </button>
  );
}
