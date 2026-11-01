"use client";

import { useState } from "react";
import { type LessonPlayerState } from "./lesson-player-state";

type LessonScreenRef = { key: string; stepId: string };

export function getScreenRef(state: LessonPlayerState, stepId: string): LessonScreenRef {
  return { key: `${stepId}:${state.rounds[stepId] ?? 0}`, stepId };
}

/**
 * The screens the learner left unfinished (with Previous or "Explain first"): unchecked and still
 * ahead of them. The stage keeps them hidden until the learner comes back, so they show as left.
 * Call where the lesson stays mounted across screen changes.
 */
export function useKeptScreens(
  state: LessonPlayerState,
  shown: LessonScreenRef | null,
): LessonScreenRef[] {
  const [seen, setSeen] = useState<{ kept: LessonScreenRef[]; shown: LessonScreenRef | null }>({
    kept: [],
    shown,
  });

  const isLive = (screen: LessonScreenRef) =>
    screen.key !== shown?.key && screen.key === getScreenRef(state, screen.stepId).key;

  if (seen.shown?.key === shown?.key) {
    return seen.kept.filter((screen) => isLive(screen));
  }

  const left = seen.shown;

  const isUnfinished =
    left !== null &&
    !(left.stepId in state.results) &&
    state.queue.includes(left.stepId, state.position + 1);

  const kept = [...(isUnfinished ? [left] : []), ...seen.kept].filter((screen) => isLive(screen));

  setSeen({ kept, shown });
  return kept;
}
