import "server-only";
import { type Goal, prisma, sql } from "@zoonk/db";
import { hasPlanDeadline, withinLessonScope } from "../../plans/_utils/plan-end";
import { findUpNextItem } from "../../plans/_utils/up-next-item";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { loadTodayLearnBlocks } from "../../view-models/_utils/today-lesson-order";
import {
  type MindMapChapterRow,
  mindMapChapterRows,
  toMindMapRow,
} from "./listed-mind-map-chapters";
import { type MindMapRow } from "./mind-map-view";

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

/**
 * What a map's status reads for the saved plan's chapters (all of them, or the ones asked for), in
 * plan order: each one's number and state in the plan, whether its lessons are written and its
 * map's row, in one grouped statement (`mindMapChapterRows`). A chapter the learner can't see isn't
 * listed.
 */
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

/**
 * The chapter the learner is in, as the Plan marks it current: the one holding the lesson up next
 * (`findUpNextItem`), with the lessons left in it in that phase, as the Plan counts them
 * (`withinLessonScope`). Read from the saved plan and today's session, never building either. Null
 * when the lesson up next isn't a chapter's or nothing is left.
 */
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
          where: { kind: { in: ["chapter", "lesson"] }, status: { in: ["todo", "skipped"] } },
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
