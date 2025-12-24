import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";
import { getOrganization, hasCoursePermission } from "./organizations";
import type { ContentVisibility } from "./types";

export const searchCourses = cache(
  async (params: {
    title: string;
    orgSlug: string;
    visibility: ContentVisibility;
    language?: string;
    headers?: Headers;
  }): Promise<{ data: Course[]; error: Error | null }> => {
    const { title, orgSlug, language, visibility } = params;
    const normalizedSearch = normalizeString(title);
    const permission = visibility === "published" ? "read" : "update";

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug,
          permission,
        }),
        getOrganization(orgSlug),
        prisma.course.findMany({
          orderBy: { createdAt: "desc" },
          where: {
            normalizedTitle: {
              contains: normalizedSearch,
              mode: "insensitive",
            },
            organization: { slug: orgSlug },
            ...(language && { language }),
            ...(visibility === "published" && { isPublished: true }),
            ...(visibility === "draft" && { isPublished: false }),
          },
        }),
      ]),
    );

    if (error) {
      return { data: [], error };
    }

    const [hasPermission, { data: org }, courses] = data;
    const isBrandOrg = org?.kind === "brand";
    const canAccess =
      hasPermission || (visibility === "published" && isBrandOrg);

    if (!canAccess) {
      return { data: [], error: new Error("Forbidden") };
    }

    return { data: courses, error: null };
  },
);

export const courseSlugExists = cache(
  async (params: {
    language: string;
    orgSlug: string;
    slug: string;
  }): Promise<boolean> => {
    const { data } = await safeAsync(() =>
      prisma.course.findFirst({
        select: { id: true },
        where: {
          language: params.language,
          organization: { slug: params.orgSlug },
          slug: params.slug,
        },
      }),
    );

    return data !== null;
  },
);

export async function toggleCoursePublished(params: {
  courseId: number;
  isPublished: boolean;
  headers?: Headers;
}): Promise<SafeReturn<Course>> {
  const { data: course, error: findError } = await safeAsync(() =>
    prisma.course.findUnique({
      select: { id: true, organizationId: true },
      where: { id: params.courseId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!course) {
    return { data: null, error: new Error("Course not found") };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: course.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new Error("Forbidden") };
  }

  const { data, error } = await safeAsync(() =>
    prisma.course.update({
      data: { isPublished: params.isPublished },
      where: { id: course.id },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
