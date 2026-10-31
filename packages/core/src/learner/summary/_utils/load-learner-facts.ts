import "server-only";
import { prisma, sql } from "@zoonk/db";
import {
  type MindMapChapterState,
  isListedMindMapChapter,
  mindMapChapterRows,
} from "../../../mind-maps/_utils/listed-mind-map-chapters";

const RECENT_STUDY_DAYS = 4;

/** A day the learner studied: its `YYYY-MM-DD` date and the time spent in it. */
export type StudyDay = { date: string; timeSpentSeconds: number };

export type LearnerFacts = {
  /** The blueprint each goal names, by goal id. */
  blueprintNames: Record<string, string>;
  currentEnergy: number | null;
  lastActiveAt: Date | null;
  mindMapGoalIds: string[];
  recentStudyDays: StudyDay[];
  /** The learner's speaking score, by language. */
  speakingScores: Record<string, number>;
  totalBrainPower: bigint | null;
};

type MindMapChapterFacts = Pick<
  MindMapChapterState,
  "canHaveMap" | "hasWrittenLessons" | "mapStatus" | "mapStructure"
> & { goalId: string; mapUpdatedAt: number | null };

type LearnerFactsRow = Omit<LearnerFacts, "mindMapGoalIds"> & {
  mindMapChapters: MindMapChapterFacts[];
};

export async function loadLearnerFacts(userId: string): Promise<LearnerFacts> {
  const mindMapGoals = sql`g.user_id = ${userId}::uuid AND g.status <> 'archived'`;

  const rows = await prisma.$queryRaw<LearnerFactsRow[]>`
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
      (
        SELECT coalesce(
          json_agg(json_build_object(
            'canHaveMap', m."canHaveMap",
            'goalId', m."goalId",
            'hasWrittenLessons', m."hasWrittenLessons",
            'mapStatus', m."mapStatus",
            -- Milliseconds: a zoneless timestamp in JSON would read as local time.
            'mapUpdatedAt', extract(epoch FROM m."mapUpdatedAt") * 1000,
            -- Only a map without written lessons to draw it again from is listed by its outline.
            'mapStructure', CASE WHEN m."hasWrittenLessons" THEN NULL ELSE m."mapStructure" END
          )),
          '[]'::json
        )
        FROM (${mindMapChapterRows(mindMapGoals)}) m
        -- Only these can be listed (getMindMapStatus): the rest stay out of the JSON.
        WHERE m."canHaveMap" AND (m."hasWrittenLessons" OR m."mapStatus" IS NOT NULL)
      ) AS "mindMapChapters"
    FROM (SELECT ${userId}::uuid AS id) u
    LEFT JOIN user_progress up ON up.user_id = u.id`;

  const [row] = rows;

  if (!row) {
    throw new Error("The learner's facts read returned no row");
  }

  const { mindMapChapters, ...facts } = row;
  const now = new Date();

  const listed = mindMapChapters.filter((chapter) =>
    isListedMindMapChapter({
      chapter: {
        ...chapter,
        mapImageHeight: null,
        mapImageUrl: null,
        mapImageWidth: null,
        mapThumbnailUrl: null,
        mapUpdatedAt: chapter.mapUpdatedAt ? new Date(chapter.mapUpdatedAt) : null,
      },
      now,
    }),
  );

  return { ...facts, mindMapGoalIds: [...new Set(listed.map((chapter) => chapter.goalId))] };
}
