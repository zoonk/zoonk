import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateTag } from "next/cache";
import {
  COURSE_LIST_CACHE_TAG,
  getCourseCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { getSession } from "../../users/get-session";
import { getCompletableLessonWhere } from "./_utils/completable-lesson";

/**
 * Immediately expires every cached resource changed by a lesson start so
 * Server Actions and Route Handlers share one invalidation contract.
 */
function revalidateLessonStart({ courseId, userId }: { courseId: string; userId: string }) {
  revalidateTag(COURSE_LIST_CACHE_TAG, { expire: 0 });
  revalidateTag(getCourseCacheTag(courseId), { expire: 0 });
  revalidateTag(getUserProgressCacheTag(userId), { expire: 0 });
}

/**
 * Records that the current learner started a lesson and enrolls them in its
 * course. The outcome distinguishes authentication and resource failures for
 * HTTP and native adapters, while the session-derived user ID keeps both writes
 * scoped to the current learner.
 */
export async function startLesson(lessonId: string) {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (!isUuid(lessonId)) {
    return { status: "notFound" as const };
  }

  const userId = session.user.id;

  const reference = await prisma.lesson.findFirst({
    include: { chapter: true },
    where: getCompletableLessonWhere({ generationStatus: "completed", lessonId, userId }),
  });

  if (!reference) {
    return { status: "notFound" as const };
  }

  const courseId = reference.chapter.courseId;

  const started = await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT id FROM courses WHERE id = ${courseId}::uuid FOR UPDATE`;

    const lesson = await transaction.lesson.findFirst({
      include: { chapter: { include: { course: true } } },
      where: getCompletableLessonWhere({ generationStatus: "completed", lessonId, userId }),
    });

    if (!lesson) {
      return false;
    }

    const contentSnapshot = {
      chapterId: lesson.chapterId,
      chapterTitle: lesson.chapter.title,
      contentRevision: lesson.chapter.course.contentRevision,
      courseId,
      courseTitle: lesson.chapter.course.title,
      lessonId,
      lessonTitle: lesson.title,
    };

    await transaction.lessonProgress.upsert({
      create: { contentSnapshot, lessonId, userId },
      update: {},
      where: { userLesson: { lessonId, userId } },
    });

    const membership = await transaction.courseUser.createMany({
      data: { courseId, userId },
      skipDuplicates: true,
    });

    if (membership.count > 0) {
      await transaction.course.update({
        data: { userCount: { increment: 1 } },
        where: { id: courseId },
      });
    }

    return true;
  });

  if (!started) {
    return { status: "notFound" as const };
  }

  revalidateLessonStart({ courseId, userId });
  return { status: "started" as const };
}
