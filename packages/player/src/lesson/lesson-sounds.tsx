"use client";

import { useEffect, useRef } from "react";
import { playLessonSound } from "./_utils/lesson-sounds";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";

export function LessonSounds() {
  const { soundsEnabled } = useLessonPlayerConfig();
  const { screen, state } = useLessonPlayer();
  const previousPhase = useRef(state.phase);
  const stepId = screen.step?.id;
  const isCorrect = stepId ? state.results[stepId]?.isCorrect : undefined;

  useEffect(() => {
    const phaseChanged = previousPhase.current !== state.phase;
    previousPhase.current = state.phase;

    if (!soundsEnabled || !phaseChanged || state.reviewing) {
      return;
    }

    if (state.phase === "completed") {
      playLessonSound("finish");
    } else if (state.phase === "feedback" && isCorrect) {
      playLessonSound("correct");
    }
  }, [isCorrect, soundsEnabled, state.phase, state.reviewing]);

  return null;
}
