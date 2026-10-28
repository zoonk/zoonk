import { type MistakeDrillKind, isPastTimeLimit } from "./mistake-drills";

const MS_PER_SECOND = 1000;

type DrillRules = { kind: MistakeDrillKind; timeLimitSeconds: number | null };

/** Reaching the full time box counts as wrong; trap names come only from the selected wrong answer's misconception. */
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
