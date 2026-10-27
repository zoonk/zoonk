import "server-only";
import { prisma } from "@zoonk/db";
import { type FirstStepKind } from "./catalog";

type DoneAt = Partial<Record<FirstStepKind, Date>>;

type HistoryRow = {
  askedAt: Date | null;
  callAt: Date | null;
  challengeAt: Date | null;
  essayAt: Date | null;
  firstGoalId: string | null;
  firstSessionAt: Date | null;
  firstSessionGoalId: string | null;
  fixedAt: Date | null;
  lessonAt: Date | null;
  mockAt: Date | null;
  patternAt: Date | null;
  reviewAt: Date | null;
  studyDays: number;
};

const RETIRE_AFTER_STUDY_DAYS = 14;

/** Account-wide history is one scoped projection; content deletion never erases a finished step. */
export async function loadFirstStepHistory(userId: string) {
  const [row] = await prisma.$queryRaw<HistoryRow[]>`
    WITH first_session AS (
      SELECT created_at, goal_id FROM study_sessions
      WHERE user_id = ${userId}::uuid
      ORDER BY created_at ASC LIMIT 1
    ), events AS (
      SELECT kind, lesson_kind, ended_at FROM learning_events
      WHERE user_id = ${userId}::uuid AND ended_at IS NOT NULL
    )
    SELECT
      (SELECT id::text FROM goals WHERE user_id = ${userId}::uuid AND kind <> 'explain'
        ORDER BY created_at ASC, id ASC LIMIT 1) AS "firstGoalId",
      (SELECT created_at FROM first_session) AS "firstSessionAt",
      (SELECT goal_id::text FROM first_session) AS "firstSessionGoalId",
      (SELECT count(*)::int FROM daily_progress
        WHERE user_id = ${userId}::uuid AND time_spent_seconds > 0) AS "studyDays",
      (SELECT min(ended_at) FROM events WHERE kind = 'lesson') AS "lessonAt",
      (SELECT min(ended_at) FROM events WHERE kind = 'checkpoint') AS "challengeAt",
      (SELECT min(fixed_at) FROM mistakes WHERE user_id = ${userId}::uuid) AS "fixedAt",
      (SELECT min(q.created_at) FROM lesson_questions q
        JOIN lesson_question_threads t ON t.id = q.thread_id
        WHERE t.user_id = ${userId}::uuid) AS "askedAt",
      (SELECT min(ended_at) FROM language_conversations WHERE user_id = ${userId}::uuid) AS "callAt",
      LEAST(
        (SELECT min(finished_at) FROM mock_exams WHERE user_id = ${userId}::uuid AND status = 'finished'),
        (SELECT min(ended_at) FROM events WHERE kind = 'mock')
      ) AS "mockAt",
      LEAST(
        (SELECT min(practiced_at) FROM mistake_patterns WHERE user_id = ${userId}::uuid),
        (SELECT min(ended_at) FROM events WHERE lesson_kind = 'patternDrill')
      ) AS "patternAt",
      (SELECT COALESCE(b.completed_at, b.updated_at) FROM study_session_blocks b
        JOIN study_sessions s ON s.id = b.session_id
        WHERE s.user_id = ${userId}::uuid AND b.kind = 'produce' AND b.status = 'completed'
        ORDER BY b.completed_at ASC NULLS LAST LIMIT 1) AS "essayAt",
      LEAST(
        (SELECT COALESCE(b.completed_at, b.updated_at) FROM study_session_blocks b
          JOIN study_sessions s ON s.id = b.session_id
          WHERE s.user_id = ${userId}::uuid AND b.kind = 'review' AND b.status = 'completed'
          ORDER BY b.completed_at ASC NULLS LAST LIMIT 1),
        (SELECT min(ended_at) FROM events WHERE kind = 'review'
          AND lesson_kind IS DISTINCT FROM 'pronunciationReview')
      ) AS "reviewAt"`;

  if (!row) {
    throw new Error("The first-step history projection returned no row");
  }

  const changedGoal = row.firstSessionAt && row.firstSessionGoalId !== row.firstGoalId;
  const retired = Boolean(changedGoal) || row.studyDays >= RETIRE_AFTER_STUDY_DAYS;

  const doneAt: DoneAt = {
    askBuddy: row.askedAt ?? undefined,
    call: row.callAt ?? undefined,
    challenge: row.challengeAt ?? undefined,
    essay: row.essayAt ?? undefined,
    fixMistake: row.fixedAt ?? undefined,
    mock: row.mockAt ?? undefined,
    pattern: row.patternAt ?? undefined,
    review: row.reviewAt ?? undefined,
    somethingNew: row.lessonAt ?? undefined,
  };

  return { doneAt: retired ? {} : doneAt, firstGoalId: row.firstGoalId ?? undefined, retired };
}
