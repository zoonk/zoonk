"use client";

import { useSpokenAudio } from "@zoonk/learn/speech";
import { useCallback, useRef } from "react";
import { useWordAudio } from "../../use-word-audio";

const SLOW_RATE = 0.7;

type PracticeSound = { audioUrl: string | null; text: string };

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

  const playRecording = useCallback(
    async (word: PracticeSound, rate: number) =>
      (await recording.play(word.audioUrl, { rate })) === "started",
    [recording],
  );

  // Mobile Safari requires speech without a recording to start inside the tap handler.
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
