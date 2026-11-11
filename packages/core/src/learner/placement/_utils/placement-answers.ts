import { sql } from "@zoonk/db";

export const TEST_ANSWER_FILTER = { isPlacement: true } as const;

export const SITTING_ANSWER_FILTER = {
  ...TEST_ANSWER_FILTER,
  itemId: { not: null },
  stepId: null,
  studySessionId: null,
} as const;

export const TEST_ANSWER_SQL = sql`is_placement = ${TEST_ANSWER_FILTER.isPlacement}`;
export const SITTING_ANSWER_SQL = sql`${TEST_ANSWER_SQL}
  AND item_id IS NOT NULL AND step_id IS NULL AND study_session_id IS NULL`;

type PlacementAnswerRow = {
  answeredAt: Date;
  isPlacement: boolean;
  itemId: string | null;
  localDate: Date;
  stepId: string | null;
  studySessionId: string | null;
};

export function isPlacementAnswer(attempt: PlacementAnswerRow): boolean {
  return (
    attempt.isPlacement &&
    attempt.itemId !== null &&
    attempt.stepId === null &&
    attempt.studySessionId === null
  );
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
