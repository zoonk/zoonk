import "server-only";
import { type GenerationStatus, type Goal, prisma, sql } from "@zoonk/db";
import { chapterLessonStats } from "./chapter-lesson-stats";
import { type MindMapRow } from "./mind-map-view";
import { mindMapScopeChapters } from "./scope-chapters";

type MindMapChapterRow = {
  canHaveMap: boolean;
  chapterId: string;
  lessonIds: string[];
  lessonsToWrite: number;
  mapImageHeight: number | null;
  mapImageUrl: string | null;
  mapImageWidth: number | null;
  mapOwed: boolean;
  mapRedrawOwedAt: Date | null;
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
  lessonIds: string[];
  lessonsToWrite: number;
  /** The learner's finish owes this map and no run has taken it yet. */
  owed: boolean;
  /** Internal scope order; display numbering must use loadChapterNumbering. */
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
    redrawOwedAt: chapter.mapRedrawOwedAt,
    status: chapter.mapStatus,
    structure: chapter.mapStructure ?? null,
    thumbnailUrl: chapter.mapThumbnailUrl,
    updatedAt: chapter.mapUpdatedAt,
  };
}

/** The goal's learner-visible mind map scope, in its order, with what each map row needs. */
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
        pc.position AS "position",
        c.title,
        g.kind <> 'language' AND c.target_language IS NULL
          AND (stats.written OR stats.to_write > 0) AS "canHaveMap",
        stats.lesson_ids AS "lessonIds",
        stats.to_write AS "lessonsToWrite",
        EXISTS (
          SELECT 1 FROM follow_ups f
          WHERE f.user_id = g.user_id AND f.kind = 'make_chapter_mind_map'
            AND f.input->>'chapterId' = pc.chapter_id::text
        ) AS "mapOwed",
        mm.status::text AS "mapStatus",
        mm.redraw_owed_at AS "mapRedrawOwedAt",
        mm.structure AS "mapStructure",
        mm.image_url AS "mapImageUrl",
        mm.image_width AS "mapImageWidth",
        mm.image_height AS "mapImageHeight",
        mm.thumbnail_url AS "mapThumbnailUrl",
        mm.updated_at AS "mapUpdatedAt"
      FROM (${mindMapScopeChapters(goalId)}) pc
      JOIN goals g ON g.id = ${goalId}::uuid
      JOIN library_chapters c ON c.id = pc.chapter_id
        AND (c.visibility = 'public' OR c.owner_id = g.user_id)
      CROSS JOIN LATERAL (${chapterLessonStats(sql`pc.chapter_id`)}) stats
      LEFT JOIN chapter_mind_maps mm ON mm.chapter_id = pc.chapter_id
    ) m
    ${only}
    ORDER BY m.position`;
}

export async function loadMindMapChapters({
  chapterIds,
  goal,
}: {
  chapterIds?: readonly string[];
  goal: MindMapGoal;
}): Promise<MindMapChapterFacts[]> {
  const chapters = await readChapterRows({ chapterIds, goalId: goal.id });

  return chapters.map((chapter) => ({
    canHaveMap: chapter.canHaveMap,
    chapterId: chapter.chapterId,
    lessonIds: chapter.lessonIds,
    lessonsToWrite: chapter.lessonsToWrite,
    owed: chapter.mapOwed,
    position: chapter.position,
    row: toMindMapRow(chapter),
    title: chapter.title,
  }));
}
