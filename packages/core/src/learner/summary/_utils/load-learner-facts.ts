import "server-only";
import { prisma, sql } from "@zoonk/db";
import { completedLessonRuns } from "../../../completed-lessons/_utils/completed-lesson-runs";

const RECENT_STUDY_DAYS = 4;

/** A day the learner studied: its `YYYY-MM-DD` date and the time spent in it. */
export type StudyDay = { date: string; timeSpentSeconds: number };

export type LearnerFacts = {
  /** The blueprint each goal names, by goal id. */
  blueprintNames: Record<string, string>;
  completedLessonGoalIds: string[];
  currentEnergy: number | null;
  hasCertificates: boolean;
  lastActiveAt: Date | null;
  recentStudyDays: StudyDay[];
  /** The learner's speaking score, by language. */
  speakingScores: Record<string, number>;
  totalBrainPower: bigint | null;
};

export async function loadLearnerFacts(userId: string): Promise<LearnerFacts> {
  const rows = await prisma.$queryRaw<LearnerFacts[]>`
    SELECT
      up.current_energy AS "currentEnergy",
      up.total_brain_power AS "totalBrainPower",
      up.last_active_at AS "lastActiveAt",
      (
        SELECT coalesce(json_object_agg(g.id, b.name), '{}'::json)
        FROM goals g JOIN exam_blueprints b ON b.id = g.exam_blueprint_id
        WHERE g.user_id = u.id
      ) AS "blueprintNames",
      (
        SELECT coalesce(json_agg(g.id), '[]'::json)
        FROM goals g
        WHERE g.user_id = u.id AND g.status <> 'archived'
          AND EXISTS (${completedLessonRuns({ goalId: sql`g.id`, userId: sql`u.id` })})
      ) AS "completedLessonGoalIds",
      EXISTS (SELECT 1 FROM certificates c WHERE c.user_id = u.id) AS "hasCertificates",
      (
        SELECT coalesce(json_object_agg(l.language, l.score), '{}'::json)
        FROM language_skill_levels l WHERE l.user_id = u.id AND l.skill = 'speaking'
      ) AS "speakingScores",
      (
        SELECT coalesce(
          json_agg(json_build_object('date', d.date, 'timeSpentSeconds', d.time_spent_seconds)),
          '[]'::json
        )
        FROM (
          SELECT date, time_spent_seconds FROM daily_progress
          WHERE user_id = u.id
            AND (time_spent_seconds > 0 OR correct_answers > 0 OR incorrect_answers > 0
              OR lessons_completed > 0)
          ORDER BY date DESC
          LIMIT ${RECENT_STUDY_DAYS}
        ) d
      ) AS "recentStudyDays"
    FROM (SELECT ${userId}::uuid AS id) u
    LEFT JOIN user_progress up ON up.user_id = u.id`;

  const [row] = rows;

  if (!row) {
    throw new Error("The learner's facts read returned no row");
  }

  return row;
}
