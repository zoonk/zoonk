import "server-only";
import { prisma, type Course } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

type CreateParams = {
  generationRunId: string;
  language: string;
  organizationId: number;
  title: string;
};

type CreatedCourse = Pick<Course, "id" | "slug">;

export async function createAICourse(params: CreateParams): Promise<SafeReturn<CreatedCourse>> {
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
