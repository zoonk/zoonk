import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateTag } from "next/cache";
import {
  COURSE_LIST_CACHE_TAG,
  getCourseCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { getSession } from "../../users/get-session";
import { enrollUserInCourse } from "../../workflows/internal/enroll-user-in-course";

/**
 * Performs the idempotent progress and enrollment writes after the public
 * command has authenticated the learner and resolved the target course.
 */
async function persistLessonStart({
  courseId,
  lessonId,
  userId,
}: {
  courseId: string;
  lessonId: string;
  userId: string;
}) {
  try {
    await Promise.all([
      prisma.lessonProgress.upsert({
        create: { lessonId, userId },
        update: {},
        where: { userLesson: { lessonId, userId } },
      }),
      enrollUserInCourse({ courseId, userId }),
    ]);
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return;
    }

    throw error;
  }
}

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

  const lesson = await prisma.lesson.findUnique({
    include: { chapter: true },
    where: { id: lessonId },
  });

  if (!lesson) {
    return { status: "notFound" as const };
  }

  const userId = session.user.id;
  const courseId = lesson.chapter.courseId;

  await persistLessonStart({ courseId, lessonId, userId });
  revalidateLessonStart({ courseId, userId });

  return { status: "started" as const };
}
