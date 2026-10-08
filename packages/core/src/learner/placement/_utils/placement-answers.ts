/** What an answer needs to tell whether it was one of placement's own, and when. */
type PlacementAnswerRow = {
  answeredAt: Date;
  itemId: string | null;
  localDate: Date;
  stepId: string | null;
  studySessionId: string | null;
};

/**
 * Placement's own answers: bank questions answered outside a lesson and outside a session
 * (sessions carry their own few questions).
 */
function isPlacementAnswer(attempt: PlacementAnswerRow): boolean {
  return attempt.itemId !== null && attempt.stepId === null && attempt.studySessionId === null;
}

/** Placement's own answers on one learner-local day. */
export function isPlacementAnswerOn({
  attempt,
  day,
}: {
  attempt: PlacementAnswerRow;
  day: Date;
}): boolean {
  return isPlacementAnswer(attempt) && attempt.localDate.getTime() === day.getTime();
}

/**
 * Whether this goal's placement began: an answer to placement since the goal was created. Earlier
 * answers on the same skills (another goal's placement, lessons) still place the learner, but they
 * didn't start this one.
 */
export function hasPlacementStarted({
  attempts,
  since,
}: {
  attempts: PlacementAnswerRow[];
  since: Date | null;
}): boolean {
  return (
    since !== null &&
    attempts.some((attempt) => isPlacementAnswer(attempt) && attempt.answeredAt >= since)
  );
}
