import "server-only";
import { getPublishedCourseWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { getOwnPrivateCourseWhere } from "./_utils/own-private-course";

const courseInclude = { categories: true, organization: true };

async function getPublishedCourseById(courseId: string) {
  "use cache";
  cacheTag(getCourseCacheTag(courseId));

  return prisma.course.findFirst({
    include: courseInclude,
    where: getPublishedCourseWhere({ id: courseId, organization: { kind: "brand" } }),
  });
}

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

/** Private courses require their owner's session; published brand courses are public. */
export async function getCourseById({ courseId }: { courseId: string }) {
  const published = await getPublishedCourseById(courseId);
  return published ?? getOwnPrivateCourseById(courseId);
}
