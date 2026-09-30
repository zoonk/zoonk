"use client";

import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { useCallback, useEffect, useRef } from "react";

/** Slow enough to hear each sound, close enough to real speech to still sound like the word. */
const SLOW_RATE = 0.7;

/**
 * Plays a review word: the native recording when there is one (a slow version plays it at 70%),
 * otherwise the device's voice for the language. Only one plays at a time.
 */
export function useWordAudio({
  audioUrl,
  language,
  word,
}: {
  audioUrl: string | null;
  language: string;
  word: string;
}) {
  const isMounted = useIsMounted();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      globalThis.speechSynthesis?.cancel();
    },
    [],
  );

  const play = useCallback(
    (slow: boolean) => {
      const rate = slow ? SLOW_RATE : 1;
      audioRef.current?.pause();
      globalThis.speechSynthesis?.cancel();

      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.playbackRate = rate;
        audio.preservesPitch = true;
        audioRef.current = audio;
        void audio.play().catch(() => null);
        return;
      }

      if (globalThis.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = language;
        utterance.rate = rate;
        globalThis.speechSynthesis.speak(utterance);
      }
    },
    [audioUrl, language, word],
  );

  // The server has no speech API, so the device's voice counts only once the page is hydrated.
  const canPlay = Boolean(audioUrl) || (isMounted && globalThis.speechSynthesis !== undefined);

  return { canPlay, play };
}
