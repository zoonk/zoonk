/**
 * When the call's objectives are checked: once an exchange settles, 1.5 s after its last
 * fragment. The learner's transcript comes back 1.3 to 1.8 s after their words, often after the
 * character's answer, so words said before that answer (by `startMs`, the session's timeline)
 * still belong to the exchange it answered.
 */

export const REPLY_SETTLED_MS = 1500;

export type CheckTiming = {
  answerStartMs: number | null;
  /** Learner words no check has read yet. */
  learnerSpoke: boolean;
};

export type CheckTimingEvent =
  | { startMs: number; type: "character" }
  /** `startMs` is missing for a typed reply. */
  | { startMs?: number; type: "learner" }
  | { type: "checked" };

export const NO_CHECK_TIMING: CheckTiming = { answerStartMs: null, learnerSpoke: false };

/** `settle`: wait the settling time again from now, call the waiting check off, or leave it. */
export function stepCheckTiming(
  timing: CheckTiming,
  event: CheckTimingEvent,
): { settle: "cancel" | "keep" | "restart"; timing: CheckTiming } {
  if (event.type === "checked") {
    return { settle: "keep", timing: { ...timing, learnerSpoke: false } };
  }

  if (event.type === "character") {
    const answered = { ...timing, answerStartMs: event.startMs };
    return { settle: timing.learnerSpoke ? "restart" : "keep", timing: answered };
  }

  const { answerStartMs } = timing;

  const late =
    event.startMs !== undefined && answerStartMs !== null && event.startMs < answerStartMs;

  return { settle: late ? "restart" : "cancel", timing: { ...timing, learnerSpoke: true } };
}
