type PlacementAnswerRow = {
  answeredAt: Date;
  itemId: string | null;
  localDate: Date;
  stepId: string | null;
  studySessionId: string | null;
};

export function isPlacementAnswer(attempt: PlacementAnswerRow): boolean {
  return attempt.itemId !== null && attempt.stepId === null && attempt.studySessionId === null;
}

export function isPlacementAnswerOn({
  attempt,
  day,
}: {
  attempt: PlacementAnswerRow;
  day: Date;
}): boolean {
  return isPlacementAnswer(attempt) && attempt.localDate.getTime() === day.getTime();
}

/** Counts only answers since this goal began; older answers still contribute placement evidence. */
export function countPlacementAnswers({
  attempts,
  since,
}: {
  attempts: PlacementAnswerRow[];
  since: Date | null;
}): number {
  return since === null
    ? 0
    : attempts.filter((attempt) => isPlacementAnswer(attempt) && attempt.answeredAt >= since)
        .length;
}
