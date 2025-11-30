import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { PERMISSION_ERROR_CODE, safeAsync } from "@zoonk/utils/error";
import { canUpdateCourses } from "./organizations";

export const LIST_COURSES_LIMIT = 20;

export type ListOrganizationCoursesOptions = {
  language?: string;
  limit?: number;
  headers?: Headers;
};

export async function listOrganizationCourses(
  organizationId: number,
  opts?: ListOrganizationCoursesOptions,
): Promise<{ data: Course[]; error: Error | null }> {
  const hasPermission = await canUpdateCourses(organizationId, {
    headers: opts?.headers,
  });

  if (!hasPermission) {
    return {
      data: [],
      error: new Error("You don't have permission to view courses", {
        cause: PERMISSION_ERROR_CODE,
      }),
    };
  }

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
