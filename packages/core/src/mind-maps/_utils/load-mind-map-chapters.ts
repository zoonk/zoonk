import "server-only";
import { type GenerationStatus, type Goal, prisma, sql } from "@zoonk/db";
import { type EntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { loadExamPrepAccess, loadPlusOnlyLessonIds } from "../../sessions/_utils/plus-only-lessons";
import { chapterLessonStats } from "./chapter-lesson-stats";
import { type MindMapRow } from "./mind-map-view";
import { planChapters } from "./plan-chapters";

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
      FROM (${planChapters(sql`g.id = ${goalId}::uuid`)}) pc
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
