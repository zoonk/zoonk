import { type Attempt, DbNull, sql } from "@zoonk/db";
import {
  NOT_LESSON_ANSWER_FILTER,
  NOT_LESSON_ANSWER_SQL,
  isLessonAnswer,
} from "@zoonk/db/lesson-answer";
import { isJsonObject } from "@zoonk/utils/json";

const STANDALONE_ANSWER_FILTER = {
  itemId: { not: null },
  ...NOT_LESSON_ANSWER_FILTER,
  studySessionId: null,
} as const;

export const COVERAGE_ANSWER_FILTER = {
  OR: [{ isPlacement: true }, STANDALONE_ANSWER_FILTER],
  answer: { equals: DbNull, path: ["practiceMistakeId"] },
  mockExamId: null,
};

export const SITTING_ANSWER_FILTER = {
  ...STANDALONE_ANSWER_FILTER,
  isPlacement: true,
  mockExamId: null,
} as const;

const STANDALONE_ANSWER_SQL = sql`item_id IS NOT NULL AND ${NOT_LESSON_ANSWER_SQL} AND study_session_id IS NULL`;

export const COVERAGE_ANSWER_SQL = sql`mock_exam_id IS NULL AND NOT (answer ? 'practiceMistakeId') AND (is_placement OR (${STANDALONE_ANSWER_SQL}))`;
export const SITTING_ANSWER_SQL = sql`mock_exam_id IS NULL AND is_placement AND ${STANDALONE_ANSWER_SQL}`;

type PlacementAnswerRow = {
  answer: unknown;
  answeredAt: Date;
  fromLesson: Attempt["fromLesson"];
  isPlacement: boolean;
  itemId: string | null;
  localDate: Date;
  mockExamId: string | null;
  stepId: string | null;
  studySessionId: string | null;
};

export function isPlacementAnswer(attempt: PlacementAnswerRow): boolean {
  return (
    attempt.mockExamId === null &&
    !(isJsonObject(attempt.answer) && "practiceMistakeId" in attempt.answer) &&
    (attempt.isPlacement ||
      (attempt.itemId !== null && !isLessonAnswer(attempt) && attempt.studySessionId === null))
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
