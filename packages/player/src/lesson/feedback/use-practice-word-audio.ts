"use client";

import { useCallback, useRef } from "react";
import { useSpeech } from "../../activities/_utils/use-speech";
import { useWordAudio } from "../../use-word-audio";

/** Slow enough to hear each sound, fast enough to still sound like the word. */
const SLOW_RATE = 0.7;

type PracticeSound = { audioUrl: string | null; text: string };

/**
 * Plays a word to practice: the native recording when the vocabulary has one, otherwise the
 * device's voice for the language. `playBoth` plays it at normal speed, then slowly.
 */
export function usePracticeWordAudio({
  audioUrls,
  language,
}: {
  audioUrls: (string | null)[];
  language: string;
}) {
  const speech = useSpeech(language);
  const slowNextRef = useRef<PracticeSound | null>(null);

  const recording = useWordAudio({
    onEnded: () => {
      const slow = slowNextRef.current;
      slowNextRef.current = null;

      if (slow) {
        void recording.play(slow.audioUrl, { rate: SLOW_RATE });
      }
    },
    preloadUrls: audioUrls,
  });

  const speak = useCallback(
    (word: PracticeSound, rate: number, onDone?: () => void) =>
      speech.speak({ onDone, rate, segments: [word.text] }),
    [speech],
  );

  /** Starts the recording, or says why it can't: no recording, or the browser refused. */
  const playRecording = useCallback(
    async (word: PracticeSound, rate: number) =>
      (await recording.play(word.audioUrl, { rate })) === "started",
    [recording],
  );

  const play = useCallback(
    async (word: PracticeSound, { slow }: { slow: boolean }) => {
      const rate = slow ? SLOW_RATE : 1;
      slowNextRef.current = null;
      speech.cancel();

      if (!(await playRecording(word, rate))) {
        speak(word, rate);
      }
    },
    [playRecording, speak, speech],
  );

  const playBoth = useCallback(
    async (word: PracticeSound) => {
      speech.cancel();
      slowNextRef.current = word;

      if (await playRecording(word, 1)) {
        return;
      }

      slowNextRef.current = null;
      speak(word, 1, () => speak(word, SLOW_RATE));
    },
    [playRecording, speak, speech],
  );

  return { play, playBoth };
}
