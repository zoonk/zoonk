import "server-only";
import { getPublishedCourseWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseCacheTag } from "../cache/tags";
import { getSession } from "../users/get-session";
import { getReadableCourseWhere } from "./course-access";

/**
 * Loads one published brand course by its stable resource ID. The related
 * organization, categories, and first originating prompt are included because
 * every delivery app needs the same canonical course metadata and generation
 * link without composing separate database reads.
 */
export async function getCourseById({ courseId }: { courseId: string }) {
  "use cache: private";
  const session = await getSession();

  cacheTag(getCourseCacheTag(courseId));

  return prisma.course.findFirst({
    include: {
      categories: true,
      organization: true,
      prompts: { orderBy: { createdAt: "asc" }, take: 1 },
    },
    where: getPublishedCourseWhere({
      ...getReadableCourseWhere(session?.user.id ?? null),
      id: courseId,
    }),
  });
}
