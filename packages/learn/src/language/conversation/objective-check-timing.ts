/**
 * When the call's objectives are checked: once the transcript has been still for 1.5 s, if it
 * holds learner words no check read and the character answered them. The learner's words come
 * back 1.3 to 1.8 s late, often after that answer, so who spoke last is read from the session's
 * timeline (`startMs`), not from when the words arrived.
 */

export const REPLY_SETTLED_MS = 1500;

type Speaker = "character" | "learner";

export type CheckTiming = {
  latest: { speaker: Speaker; startMs: number } | null;
  learnerUnread: boolean;
};

export const NO_CHECK_TIMING: CheckTiming = { latest: null, learnerUnread: false };

/** `startMs` is missing for a typed reply: the latest words when it's sent. */
export function hearFragment(
  timing: CheckTiming,
  { speaker, startMs = timing.latest?.startMs ?? 0 }: { speaker: Speaker; startMs?: number },
): CheckTiming {
  const isLatest = timing.latest === null || startMs >= timing.latest.startMs;

  return {
    latest: isLatest ? { speaker, startMs } : timing.latest,
    learnerUnread: timing.learnerUnread || speaker === "learner",
  };
}

export function readTranscript(timing: CheckTiming): CheckTiming {
  return { ...timing, learnerUnread: false };
}

export function isCheckDue(timing: CheckTiming) {
  return timing.learnerUnread && timing.latest?.speaker === "character";
}
