import "server-only";
import { type Goal, prisma, sql } from "@zoonk/db";
import { hasPlanDeadline, withinLessonScope } from "../../plans/_utils/plan-end";
import { findUpNextItem } from "../../plans/_utils/up-next-item";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { loadTodayLearnBlocks } from "../../view-models/_utils/today-lesson-order";
import {
  type MindMapChapterRow,
  mindMapChapterRows,
  toMindMapRow,
} from "./listed-mind-map-chapters";
import { type MindMapRow } from "./mind-map-view";

export type MindMapChapterFacts = {
  /** Finished by study or test-out; never a language unit. */
  canHaveMap: boolean;
  chapterId: string;
  hasWrittenLessons: boolean;
  /** Internal plan order; display numbering must use loadChapterNumbering. */
  position: number;
  row: MindMapRow | null;
  title: string;
};

/** Returns only visible chapters, in saved plan order. */
export async function loadMindMapChapters({
  chapterIds,
  goal,
}: {
  chapterIds?: readonly string[];
  goal: Pick<Goal, "id">;
}): Promise<MindMapChapterFacts[]> {
  const only = chapterIds ? sql`WHERE m."chapterId" = ANY(${[...chapterIds]}::uuid[])` : sql``;

  const chapters = await prisma.$queryRaw<MindMapChapterRow[]>`
    SELECT * FROM (${mindMapChapterRows(sql`g.id = ${goal.id}::uuid`)}) m
    ${only}
    ORDER BY m.position`;

  return chapters.map((chapter) => ({
    canHaveMap: chapter.canHaveMap,
    chapterId: chapter.chapterId,
    hasWrittenLessons: chapter.hasWrittenLessons,
    position: chapter.position,
    row: toMindMapRow(chapter),
    title: chapter.title,
  }));
}

/** Read-only; null without a chapter-backed next lesson or remaining lessons. */
export async function loadUpNextChapter(
  goal: Pick<Goal, "id" | "kind" | "targetDate" | "timezone" | "userId">,
): Promise<{ chapterId: string; lessonsLeft: number } | null> {
  const [plan, todayBlocks] = await Promise.all([
    prisma.plan.findUnique({
      select: {
        items: {
          orderBy: { position: "asc" },
          select: {
            chapterId: true,
            id: true,
            kind: true,
            lessonId: true,
            phase: true,
            status: true,
          },
          where: { kind: { in: [...LEARN_KINDS] }, status: { in: ["todo", "skipped"] } },
        },
        settings: true,
      },
      where: { goalId: goal.id },
    }),
    loadTodayLearnBlocks(goal),
  ]);

  const items = plan?.items ?? [];
  const next = findUpNextItem({ items, todayBlocks });

  if (!next?.chapterId || next.kind !== "lesson") {
    return null;
  }

  const deadline = hasPlanDeadline({
    studiesPastTarget: goal.kind === "exam" && parsePlanSettings(plan?.settings).fullCourse,
    targetDate: goal.targetDate,
  });

  const lessonsLeft = withinLessonScope({ deadline, items }).filter(
    (item) =>
      item.kind === "lesson" && item.chapterId === next.chapterId && item.phase === next.phase,
  ).length;

  return { chapterId: next.chapterId, lessonsLeft };
}
