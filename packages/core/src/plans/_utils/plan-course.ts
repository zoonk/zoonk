import "server-only";
import { CourseLevel, type Goal, type PlanItem, prisma } from "@zoonk/db";
import { type PlanCourseLevel, type PlanCourseView } from "../plan-course-contract";

const LEVEL_ORDER = Object.values(CourseLevel);

/** Lessons and chapters are what a plan teaches; checkpoints and reviews come around them. */
const LEARN_KINDS = new Set<PlanItem["kind"]>(["chapter", "lesson"]);

type CourseItem = Pick<PlanItem, "chapterId" | "kind" | "lessonId" | "status">;

/**
 * A plan is finished once every lesson and chapter in it is done, tested out or skipped: the last
 * chapter is behind the learner, even with a final checkpoint still ahead.
 */
export function isPlanFinished(items: readonly Pick<PlanItem, "kind" | "status">[]): boolean {
  const learn = items.filter((item) => LEARN_KINDS.has(item.kind));
  return learn.length > 0 && learn.every((item) => item.status !== "todo");
}

/**
 * The level after the plan's highest one, even before the course has chapters there: the Library
 * outlines a level when someone needs it. Null at the top, or before the plan uses the course.
 */
function getNextLevel(levels: readonly PlanCourseLevel[]): CourseLevel | null {
  const highest = levels.findLastIndex((level) => level.inPlan);
  return highest === -1 ? null : (levels[highest + 1]?.level ?? null);
}

/** The chapters a plan teaches: its items' chapters, and a lesson item's home chapter without one. */
async function loadPlanChapterIds(
  items: readonly Pick<PlanItem, "chapterId" | "lessonId">[],
): Promise<Set<string>> {
  const lessonIds = items.flatMap((item) =>
    !item.chapterId && item.lessonId ? item.lessonId : [],
  );

  const lessons =
    lessonIds.length > 0
      ? await prisma.lesson.findMany({
          select: { homeChapterId: true },
          where: { id: { in: lessonIds } },
        })
      : [];

  return new Set([
    ...items.flatMap((item) => item.chapterId ?? []),
    ...lessons.flatMap((lesson) => lesson.homeChapterId ?? []),
  ]);
}

/**
 * The course a goal's plan is built from (the goal's main course): its size, how much of it the
 * plan uses and its levels with the plan's marked. Null when the goal has no course yet or it's
 * gone. A private course has no levels and no public page.
 */
export async function loadPlanCourse({
  goal,
  items,
}: {
  goal: Pick<Goal, "primaryCourseId" | "userId">;
  items: readonly CourseItem[];
}): Promise<PlanCourseView | null> {
  if (!goal.primaryCourseId) {
    return null;
  }

  const [course, chapterIds] = await Promise.all([
    prisma.course.findFirst({
      select: {
        courseChapters: { select: { chapterId: true, level: true } },
        id: true,
        organization: { select: { slug: true } },
        slug: true,
        title: true,
        visibility: true,
      },
      where: { OR: [{ visibility: "public" }, { userId: goal.userId }], id: goal.primaryCourseId },
    }),
    loadPlanChapterIds(items),
  ]);

  if (!course) {
    return null;
  }

  const isPrivate = course.visibility === "private";
  const placements = course.courseChapters;

  const levels = isPrivate
    ? []
    : LEVEL_ORDER.map((level) => {
        const inLevel = placements.filter((placement) => placement.level === level);

        return {
          chapterCount: inLevel.length,
          inPlan: inLevel.some((placement) => chapterIds.has(placement.chapterId)),
          level,
        };
      });

  return {
    brandSlug: isPrivate ? null : (course.organization?.slug ?? null),
    chapterCount: placements.length,
    courseId: course.id,
    courseSlug: course.slug,
    levels,
    nextLevel: getNextLevel(levels),
    planChapterCount: placements.filter((placement) => chapterIds.has(placement.chapterId)).length,
    title: course.title,
  };
}
