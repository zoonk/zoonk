import { type MistakeDrillKind, isPastTimeLimit } from "./mistake-drills";

const MS_PER_SECOND = 1000;

/** What a drill changes in grading: its kind and, for a timed drill, the per-question time box. */
type DrillRules = { kind: MistakeDrillKind; timeLimitSeconds: number | null };

/**
 * How a drill changes one graded answer. An answer that took a timed drill's whole time box is
 * wrong, and the limit reaches the mistakes notebook, so a new entry's cause reads as time. A trap
 * drill names only the misconception matching the learner's wrong answer.
 */
export function applyDrillRules({
  drill,
  dontKnow = false,
  durationMs,
  isCorrect,
  misconception,
}: {
  drill: DrillRules | null;
  dontKnow?: boolean;
  durationMs: number;
  isCorrect: boolean;
  /** The misconception behind the learner's wrong answer, from grading. */
  misconception: string | null;
}): { isCorrect: boolean; timeLimitMs: number | null; trap: string | null } {
  const timeLimitSeconds = drill?.timeLimitSeconds ?? null;

  return {
    isCorrect: !dontKnow && isCorrect && !isPastTimeLimit({ durationMs, timeLimitSeconds }),
    timeLimitMs: timeLimitSeconds === null ? null : timeLimitSeconds * MS_PER_SECOND,
    trap: !dontKnow && !isCorrect && drill?.kind === "spotTheTrap" ? misconception : null,
  };
}
