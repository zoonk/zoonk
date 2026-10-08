import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { type GoalMap } from "../../view-models/_utils/goal-map";
import { findChapterArea } from "../../view-models/chapter/_utils/chapter-area";
import { MIND_MAP_ROW_SELECT, type MindMapRow } from "./mind-map-view";

type MapGoal = Pick<Goal, "kind" | "userId">;

/** A chapter of the goal's plan with what its map's status reads. */
export type MindMapChapterFacts = {
  /** The learner finished it and it isn't a language's unit. */
  canHaveMap: boolean;
  chapterId: string;
  hasWrittenLessons: boolean;
  /** Its number in the plan; screens number it with `loadChapterNumbering`. */
  position: number;
  row: MindMapRow | null;
  title: string;
};

/** The chapters of the plan in plan order: those its items point at, then those only the map files. */
function listPlanChapterIds(map: GoalMap): string[] {
  return [
    ...new Set([
      ...map.items.flatMap((item) => item.chapterId ?? []),
      ...map.areas.flatMap((area) => area.chapterId ?? []),
    ]),
  ];
}

async function countWrittenLessons(chapterIds: string[]): Promise<Map<string, number>> {
  const counts = await prisma.chapterLesson.groupBy({
    _count: { lessonId: true },
    by: ["chapterId"],
    where: { chapterId: { in: chapterIds }, lesson: { contentStatus: "completed" } },
  });

  return new Map(counts.map((row) => [row.chapterId, row._count.lessonId]));
}

/**
 * What a map's status reads for the plan's chapters (all of them, or the ones asked for), in plan
 * order: each one's number and state in the plan, whether its lessons are written and its map's
 * row. A chapter the learner can't see isn't listed.
 */
export async function loadMindMapChapters({
  chapterIds,
  goal,
  map,
}: {
  chapterIds?: readonly string[];
  goal: MapGoal;
  map: GoalMap;
}): Promise<MindMapChapterFacts[]> {
  const ordered = listPlanChapterIds(map).filter((id) => !chapterIds || chapterIds.includes(id));

  const areas = ordered.flatMap((chapterId) => {
    const area = findChapterArea({ chapterId, map });
    return area ? [{ ...area, chapterId }] : [];
  });

  const ids = areas.map((area) => area.chapterId);

  const [chapters, written, rows] = await Promise.all([
    prisma.chapter.findMany({
      select: { id: true, targetLanguage: true, title: true },
      where: { ...libraryRowsVisibleTo(goal.userId), id: { in: ids } },
    }),
    countWrittenLessons(ids),
    prisma.chapterMindMap.findMany({
      select: { ...MIND_MAP_ROW_SELECT, chapterId: true },
      where: { chapterId: { in: ids } },
    }),
  ]);

  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const rowByChapter = new Map(rows.map((row) => [row.chapterId, row]));

  return areas.flatMap((area) => {
    const chapter = chapterById.get(area.chapterId);

    if (!chapter) {
      return [];
    }

    return [
      {
        canHaveMap:
          area.state === "done" && goal.kind !== "language" && chapter.targetLanguage === null,
        chapterId: area.chapterId,
        hasWrittenLessons: (written.get(area.chapterId) ?? 0) > 0,
        position: area.position,
        row: rowByChapter.get(area.chapterId) ?? null,
        title: chapter.title,
      },
    ];
  });
}
