import "server-only";
import { prisma } from "@zoonk/db";

/**
 * Answers outside these bounds aren't a pace: a question skipped or guessed in a few seconds, or a
 * tab left open.
 */
const MIN_ANSWER_MS = 10_000;
const MAX_ANSWER_MS = 900_000;

/** A pace needs this many answers from this many learners, so one learner's speed isn't everyone's. */
const MIN_ANSWERS = 100;
const MIN_LEARNERS = 5;

/** The exam's latest finished mocks say enough about how long its questions take. */
const RECENT_MOCKS = 500;

const MS_PER_MINUTE = 60_000;

type PaceRow = { answers: number; learners: number; ms: number | null };

/**
 * How long learners really take on one of the exam's questions, in minutes: the average answer in
 * its latest finished mocks, everyone's. Null until enough learners took enough of them, when the
 * exam's own pace (its clock) is the estimate. Shared by every learner of the exam.
 */
export async function loadMockPace(examBlueprintId: string | null): Promise<number | null> {
  "use cache";

  if (!examBlueprintId) {
    return null;
  }

  const [row] = await prisma.$queryRaw<PaceRow[]>`
    SELECT
      count(*)::int AS answers,
      count(DISTINCT a.user_id)::int AS learners,
      avg(a.duration_ms)::float AS ms
    FROM (
      SELECT id
      FROM mock_exams
      WHERE exam_blueprint_id = ${examBlueprintId}::uuid AND status = 'finished'
      ORDER BY finished_at DESC
      LIMIT ${RECENT_MOCKS}
    ) m
    JOIN attempts a ON a.mock_exam_id = m.id
    WHERE a.duration_ms BETWEEN ${MIN_ANSWER_MS} AND ${MAX_ANSWER_MS}`;

  if (!row || row.ms === null || row.answers < MIN_ANSWERS || row.learners < MIN_LEARNERS) {
    return null;
  }

  return row.ms / MS_PER_MINUTE;
}
