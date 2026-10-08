"use client";

import { useSpokenAudio } from "@zoonk/learn/speech";
import { useCallback, useRef } from "react";
import { useWordAudio } from "../../use-word-audio";

/** Slow enough to hear each sound, fast enough to still sound like the word. */
const SLOW_RATE = 0.7;

type PracticeSound = { audioUrl: string | null; text: string };

/**
 * Plays a word to practice: the native recording when the vocabulary has one, otherwise the word
 * read aloud in its language. `playBoth` plays it at normal speed, then slowly.
 */
export function usePracticeWordAudio({
  audioUrls,
  language,
}: {
  audioUrls: (string | null)[];
  language: string;
}) {
  const speech = useSpokenAudio(language);
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

  /**
   * A word without a recording is read aloud right inside the tap, which mobile Safari needs to
   * let the sound play; a recording that won't play is read aloud instead.
   */
  const play = useCallback(
    (word: PracticeSound, { slow }: { slow: boolean }) => {
      const rate = slow ? SLOW_RATE : 1;
      slowNextRef.current = null;
      speech.cancel();

      if (!word.audioUrl) {
        speak(word, rate);
        return;
      }

      void playRecording(word, rate).then((started) => {
        if (!started) {
          speak(word, rate);
        }
      });
    },
    [playRecording, speak, speech],
  );

  const playBoth = useCallback(
    (word: PracticeSound) => {
      const readBoth = () => speak(word, 1, () => speak(word, SLOW_RATE));
      speech.cancel();

      if (!word.audioUrl) {
        readBoth();
        return;
      }

      slowNextRef.current = word;

      void playRecording(word, 1).then((started) => {
        if (!started) {
          slowNextRef.current = null;
          readBoth();
        }
      });
    },
    [playRecording, speak, speech],
  );

  return { play, playBoth };
}
