import "server-only";
import { getPublishedCourseWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { getOwnPrivateCourseWhere } from "./_utils/own-private-course";

/**
 * The organization and categories come with the course because every delivery app needs the same
 * canonical course metadata without composing separate reads.
 */
const courseInclude = { categories: true, organization: true };

/** Published brand courses are the same for everyone, so one shared cache entry serves them all. */
async function getPublishedCourseById(courseId: string) {
  "use cache";
  cacheTag(getCourseCacheTag(courseId));

  return prisma.course.findFirst({
    include: courseInclude,
    where: getPublishedCourseWhere({ id: courseId, organization: { kind: "brand" } }),
  });
}

/** A private course is read with its owner's session, outside the shared cache. */
async function getOwnPrivateCourseById(courseId: string) {
  const session = await getSession();

  if (!session) {
    return null;
  }

  return prisma.course.findFirst({
    include: courseInclude,
    where: { ...getOwnPrivateCourseWhere(session.user.id), id: courseId },
  });
}

/**
 * Loads a course by its stable resource ID: a published brand course for everyone, or a private
 * course only for the learner it was made for. Brand courses never read the session, so they stay
 * cacheable for visitors.
 */
export async function getCourseById({ courseId }: { courseId: string }) {
  const published = await getPublishedCourseById(courseId);
  return published ?? getOwnPrivateCourseById(courseId);
}
