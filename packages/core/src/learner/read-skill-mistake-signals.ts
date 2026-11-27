import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { SECOND_TAKE_IDENTITY_PATTERN } from "../library/second-takes/second-take-identity";
import { CAPSULE_LEDGER_KIND } from "../milestones/award-milestones";
import {
  type SkillMistakeSignal,
  type SkillSignalAttempt,
  type SkillTeachingHistory,
  TEACHING_MISS_CAUSES,
  getSkillMistakeSignal,
  getSkillSignalWindowStart,
} from "./skill-mistake-signal";

type SignalRow = SkillTeachingHistory & ({ skillId: string } & (SkillSignalAttempt | { id: null }));

/** Pass authorized candidate skills. The transaction can see changes made while opening the day. */
export async function readSkillMistakeSignals({
  db = prisma,
  now,
  skillIds,
  userId,
}: {
  db?: TransactionClient;
  now: Date;
  skillIds: readonly string[];
  userId: string;
}): Promise<Map<string, SkillMistakeSignal>> {
  if (skillIds.length === 0) {
    return new Map();
  }

  const rows = await db.$queryRaw<SignalRow[]>`
    WITH candidates AS (
      SELECT DISTINCT unnest(${[...skillIds]}::uuid[]) AS skill_id
    ), completed_lessons AS (
      SELECT lesson.id, lesson.identity_key, event.kind, event.ended_at
      FROM learning_events event
      JOIN library_lessons lesson ON lesson.id = CASE
        WHEN pg_input_is_valid(event.content_ids->>'lessonId', 'uuid')
        THEN (event.content_ids->>'lessonId')::uuid
      END
      WHERE event.user_id = ${userId}::uuid
        AND event.kind IN ('lesson', 'review')
        AND event.ended_at <= ${now}
        AND event.lesson_kind IS DISTINCT FROM ${CAPSULE_LEDGER_KIND}
    ), history AS (
      SELECT candidate.skill_id,
        MIN(lesson.ended_at) FILTER (WHERE lesson.identity_key !~ ${SECOND_TAKE_IDENTITY_PATTERN}) AS first_at,
        MAX(lesson.ended_at) FILTER (
          WHERE lesson.kind = 'review' AND lesson.identity_key !~ ${SECOND_TAKE_IDENTITY_PATTERN}
        ) AS replayed_at,
        MAX(lesson.ended_at) FILTER (
          WHERE lesson.identity_key ~ ${SECOND_TAKE_IDENTITY_PATTERN}
        ) AS second_take_at
      FROM candidates candidate
      JOIN lesson_skills link USING (skill_id)
      JOIN completed_lessons lesson ON lesson.id = link.lesson_id
      GROUP BY candidate.skill_id
    ), boundaries AS (
      SELECT candidate.skill_id, history.replayed_at, history.second_take_at,
        COALESCE(memory.helped_at, GREATEST(history.replayed_at, history.second_take_at), history.first_at) AS helped_at
      FROM candidates candidate
      LEFT JOIN history USING (skill_id)
      LEFT JOIN learner_skills memory ON memory.user_id = ${userId}::uuid AND memory.skill_id = candidate.skill_id
    ), recent_attempts AS MATERIALIZED (
      SELECT id, skill_id, answered_at, cause, evidence, is_correct, item_id, local_date, mock_exam_id, step_id
      FROM attempts
      WHERE user_id = ${userId}::uuid
        AND answered_at >= ${getSkillSignalWindowStart(now)}
        AND answered_at <= ${now}
        AND evidence IS NOT NULL
        AND ((is_correct AND evidence = 'independent') OR
          (NOT is_correct AND cause = ANY(${TEACHING_MISS_CAUSES}::"MistakeCause"[])))
    )
    SELECT boundary.skill_id AS "skillId", boundary.helped_at AS "helpedAt",
      boundary.replayed_at AS "replayedAt", boundary.second_take_at AS "secondTakeAt",
      attempt.id, attempt.answered_at AS "answeredAt", attempt.cause, attempt.evidence,
      attempt.is_correct AS "isCorrect", attempt.item_id AS "itemId", attempt.local_date AS "localDate",
      attempt.mock_exam_id AS "mockExamId", attempt.step_id AS "stepId"
    FROM boundaries boundary
    LEFT JOIN recent_attempts attempt ON attempt.skill_id = boundary.skill_id
      AND (boundary.helped_at IS NULL OR attempt.answered_at > boundary.helped_at)
  `;

  const grouped = new Map<
    string,
    { attempts: SkillSignalAttempt[]; history: SkillTeachingHistory }
  >();

  for (const { skillId, helpedAt, replayedAt, secondTakeAt, ...row } of rows) {
    const group = grouped.get(skillId) ?? {
      attempts: [],
      history: { helpedAt, replayedAt, secondTakeAt },
    };

    if (row.id !== null) {
      group.attempts.push(row);
    }

    grouped.set(skillId, group);
  }

  return new Map(
    [...grouped].map(([skillId, group]) => [skillId, getSkillMistakeSignal({ ...group, now })]),
  );
}
