import "server-only";
import { type GenerationStatus, type Sql, sql } from "@zoonk/db";
import { type MindMapRow, getMindMapStatus } from "./mind-map-view";

/** What a chapter's map status reads (see `getMindMapStatus`), as `mindMapChapterRows` returns it. */
export type MindMapChapterState = {
  /** The learner finished it (every lesson studied or tested out) and it isn't a language's unit. */
  canHaveMap: boolean;
  hasWrittenLessons: boolean;
  mapImageHeight: number | null;
  mapImageUrl: string | null;
  mapImageWidth: number | null;
  mapStatus: GenerationStatus | null;
  mapStructure: unknown;
  mapThumbnailUrl: string | null;
  mapUpdatedAt: Date | null;
};

/** A chapter of a goal's saved plan as its mind map reads it (see `mindMapChapterRows`). */
export type MindMapChapterRow = MindMapChapterState & {
  chapterId: string;
  goalId: string;
  /** Its number in the plan: the chapters its items name, then those it only files lessons under. */
  position: number;
  title: string;
};

export function toMindMapRow(chapter: MindMapChapterState): MindMapRow | null {
  if (!chapter.mapStatus || !chapter.mapUpdatedAt) {
    return null;
  }

  return {
    imageHeight: chapter.mapImageHeight,
    imageUrl: chapter.mapImageUrl,
    imageWidth: chapter.mapImageWidth,
    status: chapter.mapStatus,
    structure: chapter.mapStructure ?? null,
    thumbnailUrl: chapter.mapThumbnailUrl,
    updatedAt: chapter.mapUpdatedAt,
  };
}

/**
 * The rule a goal's mind maps list a chapter by, and the summary's "this goal has maps": its map's
 * status is anything but `unavailable` (`getMindMapStatus`).
 */
export function isListedMindMapChapter({
  chapter,
  now,
}: {
  chapter: MindMapChapterState;
  now: Date;
}): boolean {
  return getMindMapStatus({ ...chapter, now, row: toMindMapRow(chapter) }) !== "unavailable";
}

/**
 * Every chapter the saved plans of the goals `goals` selects (a filter on `goals g`) file lessons
 * under, visible to the goal's learner, in one grouped statement, with what its map's status reads
 * (`isListedMindMapChapter` decides). The chapters its items name come first, finished once their
 * own lessons are (studied or tested out). Then, as the goal's map files skills (`expandItem`,
 * `firstPerSkill`, `getItemArea`), a lesson's home chapter where a lesson item saved without its
 * chapter or skill first teaches a skill: finished once the lessons whose first skill it files are.
 */
export function mindMapChapterRows(goals: Sql): Sql {
  return sql`
    SELECT
      pc.goal_id AS "goalId",
      pc.chapter_id AS "chapterId",
      pc.plan_position AS "position",
      c.title,
      pc.finished AND g.kind <> 'language' AND c.target_language IS NULL AS "canHaveMap",
      EXISTS (
        SELECT 1 FROM chapter_lessons cl
        JOIN library_lessons l ON l.id = cl.lesson_id
        WHERE cl.chapter_id = pc.chapter_id AND l.content_status = 'completed'
      ) AS "hasWrittenLessons",
      mm.status::text AS "mapStatus",
      mm.structure AS "mapStructure",
      mm.image_url AS "mapImageUrl",
      mm.image_width AS "mapImageWidth",
      mm.image_height AS "mapImageHeight",
      mm.thumbnail_url AS "mapThumbnailUrl",
      mm.updated_at AS "mapUpdatedAt"
    FROM (
      WITH items AS (
        SELECT p.goal_id, i.id, i.position, i.kind, i.status, i.chapter_id, i.lesson_id, i.skill_id
        FROM plans p
        JOIN goals g ON g.id = p.goal_id
        JOIN plan_items i ON i.plan_id = p.id
        WHERE ${goals}
      ),
      own AS (
        SELECT
          goal_id,
          chapter_id,
          min(position) AS first_position,
          coalesce(
            bool_and(status IN ('done', 'tested_out')) FILTER (WHERE kind IN ('chapter', 'lesson')),
            false
          ) AS finished
        FROM items
        WHERE chapter_id IS NOT NULL
        GROUP BY goal_id, chapter_id
      ),
      -- Only a plan with a lesson item saved without its chapter or skill can file a skill under
      -- a chapter none of its items names: the lesson's home. The rest skip the projection.
      filing AS (
        SELECT it.* FROM items it
        WHERE EXISTS (
          SELECT 1 FROM items h
          WHERE h.goal_id = it.goal_id AND h.chapter_id IS NULL AND h.skill_id IS NULL
            AND h.lesson_id IS NOT NULL
        )
      ),
      -- What each item teaches, in teaching order, where expandItem files it (null: a phase).
      entries AS (
        SELECT
          f.goal_id, f.id AS item_id, f.position, 0::bigint AS ord, s.id AS skill_id,
          s.merged_into_id, f.chapter_id AS area
        FROM filing f
        JOIN skills s ON s.id = f.skill_id
        UNION ALL
        SELECT
          f.goal_id, f.id, f.position, row_number() OVER (PARTITION BY f.id ORDER BY ls.created_at),
          s.id, s.merged_into_id, coalesce(f.chapter_id, l.home_chapter_id)
        FROM filing f
        JOIN library_lessons l ON l.id = f.lesson_id
        JOIN lesson_skills ls ON ls.lesson_id = f.lesson_id
        JOIN skills s ON s.id = ls.skill_id
        WHERE f.skill_id IS NULL
        UNION ALL
        SELECT
          f.goal_id, f.id, f.position,
          row_number() OVER (PARTITION BY f.id ORDER BY cl.position, ls.created_at),
          s.id, s.merged_into_id, f.chapter_id
        FROM filing f
        JOIN chapter_lessons cl ON cl.chapter_id = f.chapter_id
        JOIN lesson_skills ls ON ls.lesson_id = cl.lesson_id
        JOIN skills s ON s.id = ls.skill_id
        WHERE f.skill_id IS NULL AND f.lesson_id IS NULL
      ),
      -- Each skill, a merged duplicate as its survivor, filed where the plan first teaches it
      -- (firstPerSkill).
      first_areas AS (
        SELECT DISTINCT ON (goal_id, coalesce(merged_into_id, skill_id))
          goal_id, coalesce(merged_into_id, skill_id) AS skill_id, area, position, ord
        FROM entries
        ORDER BY goal_id, coalesce(merged_into_id, skill_id), position, ord
      ),
      -- Each lesson's area: its first skill's (getItemArea), else its chapter.
      item_areas AS (
        SELECT f.goal_id, f.position, f.status, coalesce(taught.area, f.chapter_id) AS area
        FROM filing f
        LEFT JOIN LATERAL (
          SELECT fa.area FROM entries e
          JOIN first_areas fa ON fa.goal_id = e.goal_id
            AND fa.skill_id = coalesce(e.merged_into_id, e.skill_id)
          WHERE e.item_id = f.id
          ORDER BY e.ord
          LIMIT 1
        ) taught ON true
        WHERE f.kind IN ('chapter', 'lesson')
      ),
      -- A chapter the map files skills under without an item of its own (findChapterArea): done
      -- once the lessons in it are.
      filed AS (
        SELECT
          fa.goal_id,
          fa.area AS chapter_id,
          min(ia.position) AS first_position,
          min(fa.position) AS first_taught,
          coalesce(bool_and(ia.status IN ('done', 'tested_out')), false) AS finished
        FROM first_areas fa
        LEFT JOIN item_areas ia ON ia.goal_id = fa.goal_id AND ia.area = fa.area
        WHERE fa.area IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM own o WHERE o.goal_id = fa.goal_id AND o.chapter_id = fa.area)
        GROUP BY fa.goal_id, fa.area
      )
      SELECT
        goal_id,
        chapter_id,
        finished,
        (row_number() OVER (
          PARTITION BY goal_id ORDER BY is_filed, first_position NULLS LAST, first_taught
        ))::int AS plan_position
      FROM (
        SELECT goal_id, chapter_id, finished, false AS is_filed, first_position, 0 AS first_taught
        FROM own
        UNION ALL
        SELECT goal_id, chapter_id, finished, true, first_position, first_taught FROM filed
      ) chapters
    ) pc
    JOIN goals g ON g.id = pc.goal_id
    JOIN library_chapters c ON c.id = pc.chapter_id
      AND (c.visibility = 'public' OR c.owner_id = g.user_id)
    LEFT JOIN chapter_mind_maps mm ON mm.chapter_id = pc.chapter_id`;
}
