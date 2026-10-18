import { Prisma } from "./generated/prisma/client";
import { type TransactionClient } from "./index";

/**
 * What deleted learners' study still teaches everyone. Four aggregates read learners' rows: item
 * recalibration (first answers), mock pace (mock answers), pace samples (finished lessons) and
 * estimate calibration (reported exam results). Those rows are personal and go with the learner,
 * so deleting one first moves what each aggregate needs into the `anonymous_*` tables, with
 * nothing that points back at them. Each aggregate reads its rows here, live and kept together,
 * so the two sources can't drift apart.
 */

/** A learner's first answer to each item they answered: later answers come after the lesson. */
function liveFirstAnswers(where: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    SELECT DISTINCT ON (a.item_id, a.user_id) a.item_id, a.is_correct
    FROM attempts a
    WHERE a.item_id IS NOT NULL AND ${where}
    ORDER BY a.item_id, a.user_id, a.answered_at`;
}

/** Every learner's first answer to the items `itemIds` selects, deleted learners' included. */
export function firstAnswersSql(itemIds: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`(
    (${liveFirstAnswers(Prisma.sql`a.item_id IN (${itemIds})`)})
    UNION ALL
    SELECT item_id, is_correct FROM anonymous_first_answers WHERE item_id IN (${itemIds})
  )`;
}

/** A ledger row of a finished lesson. */
const FINISHED_LESSON = Prisma.sql`e.kind = 'lesson' AND e.ended_at IS NOT NULL`;

/** The lesson a ledger row finished, when it's a Library lesson's id. */
const LEDGER_LESSON_ID = Prisma.sql`
  CASE WHEN e.content_ids->>'lessonId' ~* '^[0-9a-f-]{36}$'
    THEN (e.content_ids->>'lessonId')::uuid
  END`;

/**
 * How long each finished Library lesson of the ledger took, on learners' local days from `since`
 * to `until`, deleted learners' included (with no `user_id`).
 */
export function lessonPacesSql({ since, until }: { since: Date; until: Date }): Prisma.Sql {
  return Prisma.sql`(
    SELECT e.user_id, ${LEDGER_LESSON_ID} AS lesson_id, e.seconds
    FROM learning_events e
    WHERE e.local_date BETWEEN ${since}::date AND ${until}::date AND ${FINISHED_LESSON}
    UNION ALL
    SELECT NULL::uuid, lesson_id, seconds
    FROM anonymous_lesson_paces
    WHERE local_date BETWEEN ${since}::date AND ${until}::date
  )`;
}

/** A mock the learner finished, whose answers were graded and recorded as attempts. */
const FINISHED_MOCK = Prisma.sql`m.status = 'finished'`;

/**
 * Each answer of the exam's latest finished mocks, with who gave it (`learner`): a live learner's
 * id, or the random key a deleted learner's mocks share.
 */
export function mockAnswersSql({
  examBlueprintId,
  mocks,
}: {
  examBlueprintId: string;
  mocks: number;
}): Prisma.Sql {
  return Prisma.sql`(
    WITH mocks AS (
      SELECT m.id AS mock_key, m.finished_at
      FROM mock_exams m
      WHERE m.exam_blueprint_id = ${examBlueprintId}::uuid AND ${FINISHED_MOCK}
      UNION ALL
      SELECT DISTINCT mock_key, finished_on::timestamp
      FROM anonymous_mock_answers
      WHERE exam_blueprint_id = ${examBlueprintId}::uuid
      ORDER BY finished_at DESC NULLS LAST
      LIMIT ${mocks}
    )
    SELECT a.user_id AS learner, a.duration_ms
    FROM mocks m JOIN attempts a ON a.mock_exam_id = m.mock_key
    UNION ALL
    SELECT k.learner_key, k.duration_ms
    FROM mocks m JOIN anonymous_mock_answers k ON k.mock_key = m.mock_key
  )`;
}

/** A report calibration can use: an official score next to the estimate shown before it. */
const CALIBRATION_REPORT = Prisma.sql`
  score IS NOT NULL AND scale IS NOT NULL AND estimate_low IS NOT NULL AND estimate_high IS NOT NULL`;

/** Official results reported for the exam that calibration can use, deleted learners' included. */
export function examReportsSql(examBlueprintId: string): Prisma.Sql {
  return Prisma.sql`(
    SELECT score, scale, max_score, estimate_low, estimate_high, reported_at
    FROM exam_results
    WHERE exam_blueprint_id = ${examBlueprintId}::uuid AND ${CALIBRATION_REPORT}
    UNION ALL
    SELECT score, scale, max_score, estimate_low, estimate_high, reported_on::timestamp
    FROM anonymous_exam_results
    WHERE exam_blueprint_id = ${examBlueprintId}::uuid
  )`;
}

/**
 * Moves what the learners' rows teach every learner into the anonymous tables and deletes those
 * rows, before the learners are deleted. Only what each aggregate reads is kept: no user, goal or
 * mock id (a random key per learner and per mock keeps counts right), days instead of times, and
 * random row ids. The rows it copies are gone afterwards, so a retried deletion never counts a
 * learner twice. Feedback messages stay, without the sender's email (`emails` also matches the
 * ones they sent signed out).
 */
export async function anonymizeLearnerRecords({
  emails,
  transaction,
  userIds,
}: {
  emails: readonly string[];
  transaction: TransactionClient;
  userIds: readonly string[];
}) {
  const users = Prisma.sql`${[...userIds]}::uuid[]`;

  await transaction.$executeRaw`
    INSERT INTO anonymous_first_answers (item_id, is_correct)
    SELECT item_id, is_correct FROM (${liveFirstAnswers(Prisma.sql`a.user_id = ANY(${users})`)}) f`;

  await transaction.$executeRaw`
    WITH learners AS (SELECT id, gen_random_uuid() AS learner_key FROM unnest(${users}) id),
    mocks AS (
      SELECT m.id, l.learner_key, gen_random_uuid() AS mock_key, m.exam_blueprint_id,
        m.finished_at::date AS finished_on
      FROM mock_exams m JOIN learners l ON l.id = m.user_id
      WHERE ${FINISHED_MOCK} AND m.exam_blueprint_id IS NOT NULL AND m.finished_at IS NOT NULL
    )
    INSERT INTO anonymous_mock_answers
      (exam_blueprint_id, mock_key, learner_key, finished_on, duration_ms)
    SELECT m.exam_blueprint_id, m.mock_key, m.learner_key, m.finished_on, a.duration_ms
    FROM mocks m JOIN attempts a ON a.mock_exam_id = m.id`;

  await transaction.$executeRaw`
    INSERT INTO anonymous_lesson_paces (lesson_id, local_date, seconds)
    SELECT l.id, e.local_date, e.seconds
    FROM learning_events e JOIN library_lessons l ON l.id = ${LEDGER_LESSON_ID}
    WHERE e.user_id = ANY(${users}) AND ${FINISHED_LESSON}`;

  await transaction.$executeRaw`
    INSERT INTO anonymous_exam_results
      (exam_blueprint_id, score, scale, max_score, estimate_low, estimate_high, reported_on)
    SELECT exam_blueprint_id, score, scale, max_score, estimate_low, estimate_high, reported_at::date
    FROM exam_results
    WHERE user_id = ANY(${users}) AND exam_blueprint_id IS NOT NULL AND ${CALIBRATION_REPORT}`;

  const byUser = { userId: { in: [...userIds] } };

  await transaction.attempt.deleteMany({ where: byUser });
  await transaction.mockExam.deleteMany({ where: byUser });
  await transaction.learningEvent.deleteMany({ where: byUser });
  await transaction.examResult.deleteMany({ where: byUser });

  await transaction.feedback.updateMany({
    data: { email: null },
    where: {
      OR: [
        byUser,
        ...emails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })),
      ],
    },
  });
}
