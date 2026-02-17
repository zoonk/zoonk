"use client";

import { useCallback, useEffect, useRef } from "react";

export function useWordAudio(options?: { onEnded?: () => void }): {
  play: (url: string | null) => void;
} {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(options?.onEnded);
  onEndedRef.current = options?.onEnded;

  const play = useCallback((url: string | null) => {
    if (!url) {
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.addEventListener("ended", () => {
        onEndedRef.current?.();
      });
    }

    const audio = audioRef.current;
    audio.pause();
    audio.src = url;
    void audio.play();
  }, []);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  return { play };
}
