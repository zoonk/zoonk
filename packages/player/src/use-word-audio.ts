"use client";

import { useCallback, useEffect, useEffectEvent, useRef } from "react";

type UseWordAudioOptions = {
  onEnded?: () => void;
  preloadUrls?: (string | null)[];
};

/**
 * Word banks can repeat the same audio URL or include empty entries. Normalizing the list in one
 * place keeps the preload effect focused on the small set of files that can actually be played.
 */
function getUniqueAudioUrls(urls: (string | null)[] | undefined): string[] {
  if (!urls) {
    return [];
  }

  return [...new Set(urls.filter((url): url is string => Boolean(url)))];
}

/**
 * Reusing one audio element per URL avoids paying the fetch and decode cost on every tap. The
 * element is also configured for eager loading so short vocabulary clips are warm before playback.
 */
function createAudioElement(url: string, onEnded: () => void): HTMLAudioElement {
  const audio = new Audio();
  audio.preload = "auto";
  audio.src = url;
  audio.addEventListener("ended", onEnded);
  return audio;
}

/**
 * Resetting playback to the beginning ensures rapid reselection always restarts the same word from
 * the start instead of resuming from a partially played clip.
 */
function resetAudio(audio: HTMLAudioElement): void {
  audio.pause();
  audio.currentTime = 0;
}

/**
 * Short language clips need to start as close to instantly as possible. This hook keeps a warm
 * audio element per URL, optionally preloads likely clips on mount, and exposes simple play/pause
 * helpers for interaction components.
 */
export function useWordAudio(options?: UseWordAudioOptions): {
  pause: () => void;
  play: (url: string | null) => void;
} {
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const preloadKey = getUniqueAudioUrls(options?.preloadUrls).join("\n");

  const handleEnded = useEffectEvent((audio: HTMLAudioElement) => {
    if (activeAudioRef.current === audio) {
      activeAudioRef.current = null;
    }

    options?.onEnded?.();
  });

  const getAudio = useCallback((url: string) => {
    const cachedAudio = audioCacheRef.current.get(url);

    if (cachedAudio) {
      return cachedAudio;
    }

    const audio = createAudioElement(url, () => handleEnded(audio));

    audioCacheRef.current.set(url, audio);

    return audio;
  }, []);

  const play = useCallback(
    (url: string | null) => {
      if (!url) {
        return;
      }

      const nextAudio = getAudio(url);
      const currentAudio = activeAudioRef.current;

      if (currentAudio && currentAudio !== nextAudio) {
        resetAudio(currentAudio);
      }

      activeAudioRef.current = nextAudio;
      nextAudio.currentTime = 0;

      if (nextAudio.readyState === 0) {
        nextAudio.load();
      }

      // Browser rejects play() when rapid clicks lose the user-gesture association.
      // oxlint-disable-next-line no-empty-function -- intentional no-op for rejected play()
      nextAudio.play().catch(() => {});
    },
    [getAudio],
  );

  const pause = useCallback(() => {
    const activeAudio = activeAudioRef.current;

    if (!activeAudio) {
      return;
    }

    resetAudio(activeAudio);
    activeAudioRef.current = null;
  }, []);

  useEffect(() => {
    const preloadUrls = preloadKey ? preloadKey.split("\n") : [];

    preloadUrls.forEach((url) => {
      const audio = getAudio(url);

      if (audio.readyState === 0) {
        audio.load();
      }
    });
  }, [getAudio, preloadKey]);

  useEffect(
    () => () => {
      audioCacheRef.current.forEach((audio) => {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      });

      audioCacheRef.current.clear();
      activeAudioRef.current = null;
    },
    [],
  );

  return { pause, play };
}
