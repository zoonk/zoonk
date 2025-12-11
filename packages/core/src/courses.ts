import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";

export const LIST_COURSES_LIMIT = 20;

export type ListOrganizationCoursesOptions = {
  language?: string;
  limit?: number;
};

export type SearchCoursesOptions = {
  title: string;
  orgSlug: string;
};

export async function listOrganizationCourses(
  organizationId: number,
  opts?: ListOrganizationCoursesOptions,
): Promise<{ data: Course[]; error: Error | null }> {
  const { data, error } = await safeAsync(() =>
    prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      take: clampQueryItems(opts?.limit ?? LIST_COURSES_LIMIT),
      where: {
        organizationId,
        ...(opts?.language && { language: opts.language }),
      },
    }),
  );

  if (error) {
    return { data: [], error };
  }

  return { data: data ?? [], error: null };
}

export async function searchCourses(
  params: SearchCoursesOptions,
): Promise<{ data: Course[]; error: Error | null }> {
  const { title, orgSlug } = params;
  const normalizedSearch = normalizeString(title);

  const { data, error } = await safeAsync(() =>
    prisma.course.findMany({
      orderBy: { createdAt: "desc" },
      where: {
        normalizedTitle: { contains: normalizedSearch, mode: "insensitive" },
        organization: { slug: orgSlug },
      },
    }),
  );

  if (error) {
    return { data: [], error };
  }

  return { data: data ?? [], error: null };
}
