import "server-only";
import { prisma } from "@zoonk/db";
import { type FirstStepKind, readMissionDocument } from "./catalog";

type DoneAt = Partial<Record<FirstStepKind, Date>>;

type HistoryRow = {
  askedAt: Date | null;
  callAt: Date | null;
  challengeAt: Date | null;
  essayAt: Date | null;
  firstEventStartedAt: Date | null;
  firstGoalId: string | null;
  firstMissionAt: Date | null;
  firstMissionGoalId: string | null;
  firstStudiedId: string | null;
  firstStudiedMissions: unknown;
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
    WITH first_mission AS (
      SELECT created_at, goal_id FROM study_sessions
      WHERE user_id = ${userId}::uuid AND missions IS NOT NULL
      ORDER BY created_at ASC LIMIT 1
    ), first_studied AS (
      SELECT s.id, s.missions FROM study_sessions s
      WHERE s.user_id = ${userId}::uuid AND (
        s.started_at IS NOT NULL OR s.ended_at IS NOT NULL OR EXISTS (
          SELECT 1 FROM study_session_blocks b WHERE b.session_id = s.id AND b.status = 'completed'
        )
      ) ORDER BY s.created_at ASC LIMIT 1
    ), events AS (
      SELECT kind, lesson_kind, ended_at FROM learning_events
      WHERE user_id = ${userId}::uuid AND ended_at IS NOT NULL
    )
    SELECT
      (SELECT id::text FROM goals WHERE user_id = ${userId}::uuid AND kind <> 'explain'
        ORDER BY created_at ASC, id ASC LIMIT 1) AS "firstGoalId",
      (SELECT started_at FROM learning_events WHERE user_id = ${userId}::uuid AND ended_at IS NOT NULL
        ORDER BY ended_at ASC LIMIT 1) AS "firstEventStartedAt",
      (SELECT created_at FROM first_mission) AS "firstMissionAt",
      (SELECT goal_id::text FROM first_mission) AS "firstMissionGoalId",
      (SELECT id::text FROM first_studied) AS "firstStudiedId",
      (SELECT missions FROM first_studied) AS "firstStudiedMissions",
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

  const legacy =
    Boolean(row.firstStudiedId && readMissionDocument(row.firstStudiedMissions) === null) ||
    Boolean(
      row.firstEventStartedAt &&
      (!row.firstMissionAt || row.firstEventStartedAt < row.firstMissionAt),
    );

  const changedGoal = row.firstMissionAt && row.firstMissionGoalId !== row.firstGoalId;
  const retired = legacy || Boolean(changedGoal) || row.studyDays >= RETIRE_AFTER_STUDY_DAYS;

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
