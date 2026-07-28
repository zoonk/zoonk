import "server-only";
import { getPublishedCourseWhere, prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { getCourseCacheTag } from "../cache/tags";

/**
 * Loads one published brand course by its stable resource ID. The related
 * organization, categories, and first originating prompt are included because
 * every delivery app needs the same canonical course metadata and generation
 * link without composing separate database reads.
 */
export async function getCourseById({ courseId }: { courseId: string }) {
  "use cache";

  cacheTag(getCourseCacheTag(courseId));

  return prisma.course.findFirst({
    include: {
      categories: true,
      organization: true,
      prompts: { orderBy: { createdAt: "asc" }, take: 1 },
    },
    where: getPublishedCourseWhere({ id: courseId, organization: { kind: "brand" } }),
  });
}
