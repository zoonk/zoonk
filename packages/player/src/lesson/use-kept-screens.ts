"use client";

import { useState } from "react";
import { showAttemptAt } from "./_utils/lesson-attempts";
import { type LessonPlayerState } from "./lesson-player-state";

type LessonScreenRef = { key: string; stepId: string };

export function getScreenRef(state: LessonPlayerState, stepId: string): LessonScreenRef {
  return { key: `${stepId}:${state.rounds[stepId] ?? 0}`, stepId };
}

function getQueueKeys(state: LessonPlayerState): Set<string> {
  return new Set(
    state.queue.map((stepId, position) => getScreenRef(showAttemptAt(state, position), stepId).key),
  );
}

/**
 * Every screen the learner left that the lesson can still show. The stage keeps them hidden until
 * the learner comes back, so each shows what they did on it, including canvas work its answer
 * doesn't hold (a code runner's edits, a dial's angle). Call where the lesson stays mounted across
 * screen changes.
 */
export function useKeptScreens(
  state: LessonPlayerState,
  shown: LessonScreenRef | null,
): LessonScreenRef[] {
  const [seen, setSeen] = useState<{ kept: LessonScreenRef[]; shown: LessonScreenRef | null }>({
    kept: [],
    shown,
  });

  const keys = getQueueKeys(state);
  const isLive = (screen: LessonScreenRef) => screen.key !== shown?.key && keys.has(screen.key);

  if (seen.shown?.key === shown?.key) {
    return seen.kept.filter((screen) => isLive(screen));
  }

  const kept = [...(seen.shown ? [seen.shown] : []), ...seen.kept].filter((screen) =>
    isLive(screen),
  );

  setSeen({ kept, shown });
  return kept;
}
