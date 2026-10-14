import "server-only";
import { prisma } from "@zoonk/db";

/** How many of the learner's latest days with study are enough to tell today and earlier apart. */
const RECENT_STUDY_DAYS = 4;

/** A day the learner studied: its `YYYY-MM-DD` date and the time spent in it. */
export type StudyDay = { date: string; timeSpentSeconds: number };

/**
 * What the summary reads beside the learner's rows: progress (Brain Power and Energy), their
 * latest days with study, the goals whose mind maps have a chapter to show, and what tells a
 * language goal's speaking paper: the names of the blueprints goals name and the speaking scores.
 */
export type LearnerFacts = {
  /** The blueprint each goal names, by goal id. */
  blueprintNames: Record<string, string>;
  currentEnergy: number | null;
  lastActiveAt: Date | null;
  /** The goals (not archived, not a language's) with a finished chapter its mind maps list. */
  mindMapGoalIds: string[];
  recentStudyDays: StudyDay[];
  /** The learner's speaking score, by language. */
  speakingScores: Record<string, number>;
  totalBrainPower: bigint | null;
};

/**
 * The learner's facts in one statement. A goal's mind maps list a chapter the learner finished
 * (every lesson studied or tested out) outside a language, visible to them, with written lessons
 * or a map being made or made: the listing rule of `listGoalMindMaps`, asked as "is there one".
 */
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
      ) AS "recentStudyDays",
      ARRAY(
        SELECT DISTINCT p.goal_id::text
        FROM plans p
        JOIN goals g ON g.id = p.goal_id
        JOIN plan_items i ON i.plan_id = p.id
        JOIN library_chapters c ON c.id = i.chapter_id
        WHERE g.user_id = u.id AND g.status <> 'archived' AND g.kind <> 'language'
          AND i.kind IN ('chapter', 'lesson') AND c.target_language IS NULL
          AND (c.visibility = 'public' OR c.owner_id = u.id)
        GROUP BY p.goal_id, i.chapter_id
        HAVING bool_and(i.status IN ('done', 'tested_out')) AND (
          EXISTS (
            SELECT 1 FROM chapter_lessons cl
            JOIN library_lessons l ON l.id = cl.lesson_id
            WHERE cl.chapter_id = i.chapter_id AND l.content_status = 'completed'
          )
          OR EXISTS (
            SELECT 1 FROM chapter_mind_maps mm
            WHERE mm.chapter_id = i.chapter_id AND mm.status IN ('completed', 'running')
          )
        )
      ) AS "mindMapGoalIds"
    FROM (SELECT ${userId}::uuid AS id) u
    LEFT JOIN user_progress up ON up.user_id = u.id`;

  const [facts] = rows;

  if (!facts) {
    throw new Error("The learner's facts read returned no row");
  }

  return facts;
}
