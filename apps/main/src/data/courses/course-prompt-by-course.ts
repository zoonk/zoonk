import "server-only";
import { type CoursePrompt, prisma } from "@zoonk/db";
import { AI_ORG_SLUG } from "@zoonk/utils/org";

/**
 * Finds the prompt that owns an existing course shell. Course pages redirect
 * empty AI courses here so learners can resume the generation run that created
 * that shell.
 */
export async function getCoursePromptByCourseSlug({
  language,
  slug,
}: {
  language: string;
  slug: string;
}): Promise<CoursePrompt | null> {
  const course = await prisma.course.findFirst({
    include: { prompts: { orderBy: { createdAt: "asc" }, take: 1 } },
    where: { language, organization: { slug: AI_ORG_SLUG }, slug },
  });

  return course?.prompts[0] ?? null;
}
