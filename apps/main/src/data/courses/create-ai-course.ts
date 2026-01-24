import "server-only";
import { type Course, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

export async function createAICourse(params: {
  generationRunId: string;
  language: string;
  organizationId: number;
  title: string;
}): Promise<SafeReturn<Pick<Course, "id" | "slug">>> {
  const slug = toSlug(params.title);
  const normalizedTitle = normalizeString(params.title);

  const { data, error } = await safeAsync(() =>
    prisma.course.create({
      data: {
        generationRunId: params.generationRunId,
        generationStatus: "running",
        isPublished: true,
        language: params.language,
        normalizedTitle,
        organizationId: params.organizationId,
        slug,
        title: params.title,
      },
      select: { id: true, slug: true },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
