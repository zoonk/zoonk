import "server-only";

import type { Course } from "@zoonk/db";
import { prisma } from "@zoonk/db";
import { AI_ORG_ID } from "@zoonk/utils/constants";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

type CreateParams = {
  language: string;
  title: string;
  generationRunId: string;
};

type CreatedCourse = Pick<Course, "id" | "slug">;

export async function createAICourse(
  params: CreateParams,
): Promise<SafeReturn<CreatedCourse>> {
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
        organizationId: AI_ORG_ID,
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
