import "server-only";

import { auth } from "@zoonk/auth";
import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { headers } from "next/headers";
import { getOrganizationBySlug, hasCoursePermission } from "./organizations";

export const LIST_COURSES_LIMIT = 20;

export async function listOrganizationCourses(
  organizationId: number,
  opts?: {
    language?: string;
    limit?: number;
  },
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

export async function searchCourses(params: {
  title: string;
  orgSlug: string;
}): Promise<{ data: Course[]; error: Error | null }> {
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

/**
 * Checks if a course with the given slug already exists for the organization and language.
 */
export async function courseSlugExists(params: {
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
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
}

export async function createCourse(params: {
  description: string;
  language: string;
  orgSlug: string;
  slug: string;
  title: string;
}): Promise<SafeReturn<Course>> {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    return { data: null, error: new Error("Unauthorized") };
  }

  const { data: org } = await getOrganizationBySlug(params.orgSlug);

  if (!org) {
    return { data: null, error: new Error("Organization not found") };
  }

  const hasPermission = await hasCoursePermission(org.id, "create");

  if (!hasPermission) {
    return { data: null, error: new Error("Forbidden") };
  }

  const courseSlug = toSlug(params.slug);
  const normalizedTitle = normalizeString(params.title);

  const { data, error } = await safeAsync(() =>
    prisma.course.create({
      data: {
        authorId: Number(session.user.id),
        description: params.description,
        language: params.language,
        normalizedTitle,
        organizationId: org.id,
        slug: courseSlug,
        title: params.title,
      },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}
