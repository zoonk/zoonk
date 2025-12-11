import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { safeAsync } from "@zoonk/utils/error";

export const LIST_COURSES_LIMIT = 20;

export type ListOrganizationCoursesOptions = {
  language?: string;
  limit?: number;
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
