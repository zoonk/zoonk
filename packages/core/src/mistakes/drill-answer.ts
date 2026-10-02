import { type SessionItem } from "../sessions/_utils/session-items";
import { type MistakeDrillKind, isPastTimeLimit } from "./mistake-drills";

const MS_PER_SECOND = 1000;

/** What a drill changes in grading: its kind and, for a timed drill, the per-question time box. */
type DrillRules = { kind: MistakeDrillKind; timeLimitSeconds: number | null };

/** The first misconception a question's wrong answers carry, when it names one. */
function getFirstTrap(item: SessionItem): string | null {
  if (item.format === "matchPairs") {
    return null;
  }

  if (item.format === "numeric") {
    return item.content.math.commonMistakes[0]?.misconception ?? null;
  }

  if (item.format === "trueFalse") {
    return item.content.misconception ?? null;
  }

  return (
    item.content.options.find((option) => !option.isCorrect && option.misconception)
      ?.misconception ?? null
  );
}

/**
 * How a drill changes one graded answer. An answer that took a timed drill's whole time box is
 * wrong, and the limit reaches the mistakes notebook, so a new entry's cause reads as time. A trap
 * drill names the trap after every answer: the one the learner fell for, or else the one the
 * question sets, so a right answer still shows what to watch for.
 */
export function applyDrillRules({
  drill,
  durationMs,
  isCorrect,
  item,
  misconception,
}: {
  drill: DrillRules | null;
  durationMs: number;
  isCorrect: boolean;
  item: SessionItem;
  /** The misconception behind the learner's wrong answer, from grading. */
  misconception: string | null;
}): { isCorrect: boolean; timeLimitMs: number | null; trap: string | null } {
  const timeLimitSeconds = drill?.timeLimitSeconds ?? null;

  return {
    isCorrect: isCorrect && !isPastTimeLimit({ durationMs, timeLimitSeconds }),
    timeLimitMs: timeLimitSeconds === null ? null : timeLimitSeconds * MS_PER_SECOND,
    trap: drill?.kind === "spotTheTrap" ? (misconception ?? getFirstTrap(item)) : null,
  };
}
