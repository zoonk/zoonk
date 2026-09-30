import "server-only";
import { type CourseLevel, prisma } from "@zoonk/db";

/**
 * The chapter a waiting learner's first lesson is in, saved while the rest of its band's outline
 * was still being written.
 */
export type EarlyOutlineChapter = {
  chapterId: string;
  /** Goals re-planned with its lessons, which re-plan again once the whole band lands. */
  goalIds: string[];
  position: number;
};

/**
 * The chapter an earlier attempt of a band's outline saved early before failing (the only one it
 * placed from the band's next position on), with the goals that already plan its lessons, so a
 * retry keeps it instead of writing it twice. A chapter the attempt didn't finish writing is taken
 * out of the band, so the retry writes it again; no goal plans its lessons yet, since goals
 * re-plan once it's finished. Null when nothing was placed. The course's outline claim keeps any
 * other run from writing this band meanwhile, so a chapter there is the earlier attempt's.
 *
 * This is a workflow bridge: the course comes from the run holding its outline claim.
 */
export async function findEarlyOutlineChapter({
  courseId,
  level,
  nextPosition,
}: {
  courseId: string;
  level: CourseLevel;
  nextPosition: number;
}): Promise<EarlyOutlineChapter | null> {
  const placement = await prisma.courseChapter.findFirst({
    select: { chapter: { select: { outlineStatus: true } }, chapterId: true, position: true },
    where: { courseId, level, position: { gte: nextPosition } },
  });

  if (!placement) {
    return null;
  }

  if (placement.chapter.outlineStatus !== "completed") {
    await prisma.courseChapter.delete({
      where: { courseId_chapterId: { chapterId: placement.chapterId, courseId } },
    });

    return null;
  }

  const goals = await prisma.goal.findMany({
    select: { id: true },
    where: {
      plan: {
        items: { some: { lesson: { chapters: { some: { chapterId: placement.chapterId } } } } },
      },
      status: "active",
    },
  });

  return {
    chapterId: placement.chapterId,
    goalIds: goals.map((goal) => goal.id),
    position: placement.position,
  };
}

/**
 * A band's early chapter is saved before its outline run ends, under the model the run asked for.
 * When a fallback model answered instead, the rows the run saved so far name it.
 *
 * This is a workflow bridge: the run id comes from the outline run that saved the rows.
 */
export async function relabelOutlineRun({
  model,
  runId,
}: {
  model: string;
  runId: string;
}): Promise<void> {
  await prisma.$transaction([
    prisma.chapter.updateMany({ data: { model }, where: { runId } }),
    prisma.lesson.updateMany({ data: { model }, where: { runId } }),
    prisma.skill.updateMany({ data: { model }, where: { runId } }),
  ]);
}
