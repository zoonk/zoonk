import "server-only";
import { type CourseChapter, type CourseLevel, prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getCourseCurriculumCacheTag } from "../../cache/tags";
import { assertPlacementVisibility } from "../_utils/placement-visibility";

/**
 * Places a shared chapter in a course outline inside one level band. Placing
 * the same chapter again moves it, so retried workflow steps stay idempotent.
 */
export async function attachChapterToCourse({
  chapterId,
  courseId,
  level,
  position,
}: {
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

  const placement = await prisma.courseChapter.upsert({
    create: { chapterId, courseId, level, position },
    update: { level, position },
    where: { courseId_chapterId: { chapterId, courseId } },
  });

  revalidateCacheTags([getCourseCurriculumCacheTag(courseId)]);

  return placement;
}
