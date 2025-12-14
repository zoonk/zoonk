import "server-only";

import { auth } from "@zoonk/auth";
import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
import { headers } from "next/headers";
import slugify from "slugify";
import { hasCoursePermission } from "./organizations";

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

export type CreateCourseParams = {
  description: string;
  language: string;
  organizationId: number;
  slug: string;
  title: string;
};

export async function createCourse(
  params: CreateCourseParams,
): Promise<SafeReturn<Course>> {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    return { data: null, error: new Error("Unauthorized") };
  }

  const hasPermission = await hasCoursePermission(
    params.organizationId,
    "create",
  );

  if (!hasPermission) {
    return { data: null, error: new Error("Forbidden") };
  }

  const courseSlug = slugify(params.slug, { lower: true, strict: true });
  const normalizedTitle = normalizeString(params.title);

  const { data, error } = await safeAsync(() =>
    prisma.course.create({
      data: {
        authorId: Number(session.user.id),
        description: params.description,
        language: params.language,
        normalizedTitle,
        organizationId: params.organizationId,
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
