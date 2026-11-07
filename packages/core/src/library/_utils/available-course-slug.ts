import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { pickAvailableSlug } from "@zoonk/utils/string";
import { getCourseSlugForTitle } from "../../courses/course-slug";

/** Callers hold the home's `lockCourseHome` lock, so two courses never take one slug. */
export async function getAvailableCourseSlug(
  tx: TransactionClient,
  {
    home,
    language,
    title,
  }: { home: { organizationId: string } | { userId: string }; language: string; title: string },
): Promise<string> {
  const base = getCourseSlugForTitle({ language, title }) || "course";

  const taken = await tx.course.findMany({
    select: { slug: true },
    where: { ...home, slug: { startsWith: base } },
  });

  return pickAvailableSlug({ base, taken: taken.map((course) => course.slug) });
}
