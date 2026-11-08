import { type LessonPlayerState, getCurrentStep } from "../lesson-player-state";
import { type PlayableLibraryStep } from "../lesson-player-types";

type VerdictCount = Pick<LessonPlayerState, "misses" | "quickCheck">;

export function countVerdict(
  state: LessonPlayerState,
  { isCorrect, step }: { isCorrect: boolean; step: PlayableLibraryStep },
): VerdictCount {
  if (isCorrect) {
    return { misses: [], quickCheck: state.quickCheck };
  }

  return {
    misses: [...state.misses, { skillId: step.skillId, stepId: step.id }],
    quickCheck: state.quickCheck && { ...state.quickCheck, missed: true },
  };
}

/** "I know this" ends on its first miss, so the miss it holds is the one on screen. */
export function takeBackMiss(state: LessonPlayerState, stepId: string): VerdictCount {
  const missAt = state.misses.findLastIndex((miss) => miss.stepId === stepId);
  const isOnScreen = getCurrentStep(state)?.id === stepId;

  return {
    misses: state.misses.slice(missAt + 1),
    quickCheck:
      state.quickCheck && isOnScreen ? { ...state.quickCheck, missed: false } : state.quickCheck,
  };
}
