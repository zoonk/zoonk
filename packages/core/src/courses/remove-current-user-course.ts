import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateTag } from "next/cache";
import { COURSE_LIST_CACHE_TAG, getCourseCacheTag, getUserProgressCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";

/**
 * Deletes one learner's library membership and updates the course popularity
 * count in the same transaction. Progress lives in separate tables and is
 * intentionally outside this operation so learners can resume if they rejoin.
 */
async function removeCourseMembership({ courseId, userId }: { courseId: string; userId: string }) {
  return prisma.$transaction(async (transaction) => {
    const { count } = await transaction.courseUser.deleteMany({ where: { courseId, userId } });

    if (count === 0) {
      return false;
    }

    await transaction.course.update({
      data: { userCount: { decrement: 1 } },
      where: { id: courseId },
    });

    return true;
  });
}

/**
 * Removes a course from the authenticated learner's library without accepting
 * an acting user ID. Missing memberships are idempotent, while a null result
 * tells delivery adapters that the request was unauthenticated.
 */
export async function removeCurrentUserCourse({ courseId }: { courseId: string }) {
  const session = await getSession();

  if (!session) {
    return null;
  }

  if (!isUuid(courseId)) {
    return { removed: false };
  }

  const userId = session.user.id;
  const removed = await removeCourseMembership({ courseId, userId });

  if (!removed) {
    return { removed: false };
  }

  revalidateTag(COURSE_LIST_CACHE_TAG, { expire: 0 });
  revalidateTag(getCourseCacheTag(courseId), { expire: 0 });
  revalidateTag(getUserProgressCacheTag(userId), { expire: 0 });

  return { removed: true };
}
