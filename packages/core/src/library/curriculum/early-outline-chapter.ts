import "server-only";
import { type CourseLevel, prisma } from "@zoonk/db";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";

export type EarlyOutlineChapter = { chapterId: string; goalIds: string[]; position: number };

/** Internal: the calling workflow must hold the course's outline claim. */
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
    await writePlanInputs(async (tx) => {
      await lockPlanSourceWrite(tx, { chapterIds: [placement.chapterId], courseIds: [courseId] });

      await tx.courseChapter.delete({
        where: { courseId_chapterId: { chapterId: placement.chapterId, courseId } },
      });
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

/** Internal: the run id must come from the workflow that saved the outline. */
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
