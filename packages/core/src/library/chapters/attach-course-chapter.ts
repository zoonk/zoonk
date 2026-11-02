import "server-only";
import { type CourseChapter, type CourseLevel, prisma } from "@zoonk/db";
import { revalidateCourseContent } from "../../cache/revalidate-course-content";
import { getCourseCurriculumCacheTag } from "../../cache/tags";
import { assertPlacementVisibility } from "../_utils/placement-visibility";
import { lockPlanSourceWrite, writePlanInputs } from "../_utils/plan-input-write";

/** Placing an already-attached chapter moves it; retries do not add a second placement. */
export async function attachChapterToCourse({
  area,
  chapterId,
  courseId,
  level,
  position,
}: {
  area?: string | null;
  chapterId: string;
  courseId: string;
  level: CourseLevel;
  position: number;
}): Promise<CourseChapter> {
  const [chapter, course] = await Promise.all([
    prisma.chapter.findUniqueOrThrow({ where: { id: chapterId } }),
    prisma.course.findUniqueOrThrow({ where: { id: courseId } }),
  ]);

  assertPlacementVisibility({
    child: chapter,
    container: { ownerId: course.userId, visibility: course.visibility },
  });

  const placement = await writePlanInputs(async (tx) => {
    await lockPlanSourceWrite(tx, { chapterIds: [chapterId], courseIds: [courseId] });

    return tx.courseChapter.upsert({
      create: { area, chapterId, courseId, level, position },
      update: { area, level, position },
      where: { courseId_chapterId: { chapterId, courseId } },
    });
  });

  await revalidateCourseContent([getCourseCurriculumCacheTag(courseId)]);

  return placement;
}
