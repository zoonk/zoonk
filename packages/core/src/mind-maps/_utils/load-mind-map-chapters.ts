import "server-only";
import { type GenerationStatus, type Goal, prisma, sql } from "@zoonk/db";
import { type EntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { loadExamPrepAccess, loadPlusOnlyLessonIds } from "../../sessions/_utils/plus-only-lessons";
import { chapterLessonStats } from "./chapter-lesson-stats";
import { type MindMapRow } from "./mind-map-view";

type MindMapChapterRow = {
  canHaveMap: boolean;
  chapterId: string;
  lessonIds: string[];
  lessonsToWrite: number;
  mapImageHeight: number | null;
  mapImageUrl: string | null;
  mapImageWidth: number | null;
  mapOwed: boolean;
  mapStatus: GenerationStatus | null;
  mapStructure: unknown;
  mapThumbnailUrl: string | null;
  mapUpdatedAt: Date | null;
  /** Explicit chapter items precede chapters inferred from lesson membership. */
  position: number;
  title: string;
};

export type MindMapChapterFacts = {
  /** Outside a language, with a lesson written or still to write. */
  canHaveMap: boolean;
  chapterId: string;
  lessonsToWrite: number;
  /** The learner's finish owes this map and no run has taken it yet. */
  owed: boolean;
  plusRequired: boolean;
  /** Internal plan order; display numbering must use loadChapterNumbering. */
  position: number;
  row: MindMapRow | null;
  title: string;
};

type MindMapGoal = Pick<Goal, "createdAt" | "id" | "kind" | "timezone" | "userId">;

function toMindMapRow(chapter: MindMapChapterRow): MindMapRow | null {
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

/** The goal's learner-visible chapters in saved plan order, with what each map row needs. */
function readChapterRows({
  chapterIds,
  goalId,
}: {
  chapterIds?: readonly string[];
  goalId: string;
}) {
  const only = chapterIds ? sql`WHERE m."chapterId" = ANY(${[...chapterIds]}::uuid[])` : sql``;

  return prisma.$queryRaw<MindMapChapterRow[]>`
    SELECT * FROM (
      SELECT
        pc.chapter_id AS "chapterId",
        pc.plan_position AS "position",
        c.title,
        g.kind <> 'language' AND c.target_language IS NULL
          AND (stats.written OR stats.to_write > 0) AS "canHaveMap",
        stats.lesson_ids AS "lessonIds",
        stats.to_write AS "lessonsToWrite",
        EXISTS (
          SELECT 1 FROM follow_ups f
          WHERE f.user_id = g.user_id AND f.kind = 'make_chapter_mind_map'
            AND f.key = pc.chapter_id::text
        ) AS "mapOwed",
        mm.status::text AS "mapStatus",
        mm.structure AS "mapStructure",
        mm.image_url AS "mapImageUrl",
        mm.image_width AS "mapImageWidth",
        mm.image_height AS "mapImageHeight",
        mm.thumbnail_url AS "mapThumbnailUrl",
        mm.updated_at AS "mapUpdatedAt"
      FROM (
        WITH items AS (
          SELECT p.goal_id, i.id, i.position, i.kind, i.chapter_id, i.lesson_id, i.skill_id
          FROM plans p
          JOIN plan_items i ON i.plan_id = p.id
          WHERE p.goal_id = ${goalId}::uuid
        ),
        own AS (
          SELECT goal_id, chapter_id, min(position) AS first_position
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
        -- What each item teaches, in teaching order, where expandItems files it (null: a phase).
        entries AS (
          SELECT
            f.goal_id, f.id AS item_id, f.position, 0::bigint AS ord, s.id AS skill_id,
            s.merged_into_id, f.chapter_id AS area
          FROM filing f
          JOIN skills s ON s.id = f.skill_id
          UNION ALL
          SELECT
            f.goal_id, f.id, f.position,
            row_number() OVER (PARTITION BY f.id ORDER BY ls.created_at),
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
          SELECT f.goal_id, f.position, coalesce(taught.area, f.chapter_id) AS area
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
        -- A chapter the map files skills under without an item of its own (findChapterArea).
        filed AS (
          SELECT
            fa.goal_id,
            fa.area AS chapter_id,
            min(ia.position) AS first_position,
            min(fa.position) AS first_taught
          FROM first_areas fa
          LEFT JOIN item_areas ia ON ia.goal_id = fa.goal_id AND ia.area = fa.area
          WHERE fa.area IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM own o WHERE o.goal_id = fa.goal_id AND o.chapter_id = fa.area
            )
          GROUP BY fa.goal_id, fa.area
        )
        SELECT
          goal_id,
          chapter_id,
          (row_number() OVER (
            PARTITION BY goal_id ORDER BY is_filed, first_position NULLS LAST, first_taught
          ))::int AS plan_position
        FROM (
          SELECT goal_id, chapter_id, false AS is_filed, first_position, 0 AS first_taught
          FROM own
          UNION ALL
          SELECT goal_id, chapter_id, true, first_position, first_taught FROM filed
        ) chapters
      ) pc
      JOIN goals g ON g.id = pc.goal_id
      JOIN library_chapters c ON c.id = pc.chapter_id
        AND (c.visibility = 'public' OR c.owner_id = g.user_id)
      CROSS JOIN LATERAL (${chapterLessonStats(sql`pc.chapter_id`)}) stats
      LEFT JOIN chapter_mind_maps mm ON mm.chapter_id = pc.chapter_id
    ) m
    ${only}
    ORDER BY m.position`;
}

/**
 * Returns only visible chapters, in saved plan order. `readViewer` decides the Plus lock: a page's
 * display read, a fresh session check for a learner's tap, or the learner a workflow acts for.
 */
export async function loadMindMapChapters({
  chapterIds,
  goal,
  readViewer,
}: {
  chapterIds?: readonly string[];
  goal: MindMapGoal;
  readViewer?: () => Promise<EntitlementViewer | null>;
}): Promise<MindMapChapterFacts[]> {
  const [chapters, access] = await Promise.all([
    readChapterRows({ chapterIds, goalId: goal.id }),
    loadExamPrepAccess({ goal, readViewer }),
  ]);

  const held = await loadPlusOnlyLessonIds({
    access,
    goalId: goal.id,
    lessonIds: chapters.flatMap((chapter) => (chapter.canHaveMap ? chapter.lessonIds : [])),
    userId: goal.userId,
  });

  return chapters.map((chapter) => ({
    canHaveMap: chapter.canHaveMap,
    chapterId: chapter.chapterId,
    lessonsToWrite: chapter.lessonsToWrite,
    owed: chapter.mapOwed,
    plusRequired: chapter.lessonIds.some((lessonId) => held.has(lessonId)),
    position: chapter.position,
    row: toMindMapRow(chapter),
    title: chapter.title,
  }));
}
