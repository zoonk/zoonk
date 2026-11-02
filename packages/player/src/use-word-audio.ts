"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAudioPreload } from "./use-audio-preload";

type UseWordAudioOptions = { onEnded?: () => void; preloadUrls?: (string | null)[] };
type AudioPlaybackStatus = "failed" | "started";

function createAudioElement(onEnded: () => void): HTMLAudioElement {
  const audio = new Audio();
  audio.preload = "none";
  audio.addEventListener("ended", onEnded);
  return audio;
}

// Resetting the source avoids Safari's replay failure after a clip ends.
function startAudioFromSource({
  audio,
  rate,
  sourceUrl,
}: {
  audio: HTMLAudioElement;
  rate: number;
  sourceUrl: string;
}): void {
  audio.pause();
  audio.src = sourceUrl;
  audio.currentTime = 0;
  audio.playbackRate = rate;
}

// Audible playback can be rejected without an accepted user gesture.
async function getAudioPlaybackStatus(audio: HTMLAudioElement): Promise<AudioPlaybackStatus> {
  try {
    await audio.play();
    return "started";
  } catch {
    return "failed";
  }
}

export function useWordAudio(options?: UseWordAudioOptions): {
  pause: () => void;
  /** `rate` below 1 plays a slower version at the same pitch, for hearing each sound. */
  play: (url: string | null, playback?: { rate?: number }) => Promise<AudioPlaybackStatus>;
} {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onEndedRef = useRef(options?.onEnded);
  const sourceFor = useAudioPreload(options?.preloadUrls);

  const releaseAudioSource = useCallback((audio: HTMLAudioElement) => {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }, []);

  useEffect(() => {
    onEndedRef.current = options?.onEnded;
  }, [options?.onEnded]);

  const handleEnded = useCallback(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    // Reset Safari's ended media state before the next tap reuses the element.
    releaseAudioSource(audio);

    onEndedRef.current?.();
  }, [releaseAudioSource]);

  const getAudio = useCallback(() => {
    const existingAudio = audioRef.current;

    if (existingAudio) {
      return existingAudio;
    }

    const audio = createAudioElement(handleEnded);

    audioRef.current = audio;

    return audio;
  }, [handleEnded]);

  const play = useCallback(
    async (url: string | null, playback?: { rate?: number }) => {
      if (!url) {
        return "failed";
      }

      const audio = getAudio();

      startAudioFromSource({ audio, rate: playback?.rate ?? 1, sourceUrl: sourceFor(url) });
      return getAudioPlaybackStatus(audio);
    },
    [getAudio, sourceFor],
  );

  const pause = useCallback(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    releaseAudioSource(audio);
  }, [releaseAudioSource]);

  useEffect(
    () => () => {
      const audio = audioRef.current;

      if (audio) {
        releaseAudioSource(audio);
        audioRef.current = null;
      }
    },
    [releaseAudioSource],
  );

  return { pause, play };
}
