import { type PlanChapterView } from "@zoonk/core/plans/view-contract";

type ChapterRow = Pick<PlanChapterView, "chapterId" | "lessonsDone" | "lessonsTotal" | "title">;

/**
 * A chapter as the plan shows it, since the test-out itself carries only questions: its title and
 * the lessons it still has on the plan, which a pass skips. A chapter whose lessons go deeper in a
 * later phase shows in each of them, so its lessons are counted across them. Null when the plan
 * doesn't have it.
 */
export function findPlanChapter({
  chapterId,
  phases,
}: {
  chapterId: string;
  phases: readonly { chapters: readonly ChapterRow[] }[];
}): { lessonsLeft: number; title: string } | null {
  const rows = phases.flatMap((phase) =>
    phase.chapters.filter((chapter) => chapter.chapterId === chapterId),
  );

  const [first] = rows;

  if (!first) {
    return null;
  }

  const lessonsLeft = rows.reduce(
    (sum, row) => sum + Math.max(0, row.lessonsTotal - row.lessonsDone),
    0,
  );

  return { lessonsLeft, title: first.title };
}
