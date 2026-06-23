import "server-only";
import { type CourseStartRequest, prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";

/**
 * Finds the request that owns an existing course shell. Course pages redirect
 * empty AI courses here so learners can resume the generation run that created
 * that shell.
 */
export async function getCourseStartRequestByCourseSlug({
  language,
  slug,
}: {
  language: string;
  slug: string;
}): Promise<CourseStartRequest | null> {
  const course = await prisma.course.findFirst({
    include: { startRequests: { orderBy: { createdAt: "asc" }, take: 1 } },
    where: { language, organization: { slug: AI_ORG_SLUG }, slug },
  });

  return course?.startRequests[0] ?? null;
}
