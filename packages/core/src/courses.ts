import "server-only";

import { auth } from "@zoonk/auth";
import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { headers } from "next/headers";
import { cache } from "react";
import { getOrganizationBySlug, hasCoursePermission } from "./organizations";

export const LIST_COURSES_LIMIT = 20;

export const getCourse = cache(
  async (params: {
    courseSlug: string;
    language: string;
    orgSlug: string;
    headers?: Headers;
  }): Promise<SafeReturn<Course | null>> => {
    const hasPermission = await hasCoursePermission({
      headers: params.headers,
      orgSlug: params.orgSlug,
      permission: "read",
    });

    if (!hasPermission) {
      return { data: null, error: new Error("Forbidden") };
    }

    const { data, error } = await safeAsync(() =>
      prisma.course.findFirst({
        where: {
          language: params.language,
          organization: { slug: params.orgSlug },
          slug: params.courseSlug,
        },
      }),
    );

    if (error) {
      return { data: null, error };
    }

    return { data: data ?? null, error: null };
  },
);

export const listOrganizationCourses = cache(
  async (opts?: {
    orgSlug: string;
    language?: string;
    limit?: number;
    headers?: Headers;
  }): Promise<{ data: Course[]; error: Error | null }> => {
    const hasPermission = await hasCoursePermission({
      headers: opts?.headers,
      orgSlug: opts?.orgSlug,
      permission: "read",
    });

    if (!hasPermission) {
      return { data: [], error: new Error("Forbidden") };
    }

    const { data, error } = await safeAsync(() =>
      prisma.course.findMany({
        orderBy: { createdAt: "desc" },
        take: clampQueryItems(opts?.limit ?? LIST_COURSES_LIMIT),
        where: {
          organization: { slug: opts?.orgSlug },
          ...(opts?.language && { language: opts.language }),
        },
      }),
    );

    if (error) {
      return { data: [], error };
    }

    return { data: data ?? [], error: null };
  },
);

export const searchCourses = cache(
  async (params: {
    title: string;
    orgSlug: string;
  }): Promise<{ data: Course[]; error: Error | null }> => {
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

export async function createCourse(params: {
  description: string;
  language: string;
  orgSlug: string;
  slug: string;
  title: string;
  headers?: Headers;
}): Promise<SafeReturn<Course>> {
  const session = await auth.api.getSession({
    headers: params.headers ?? (await headers()),
  });

  if (!session) {
    return { data: null, error: new Error("Unauthorized") };
  }

  const { data: org } = await getOrganizationBySlug(params.orgSlug);

  if (!org) {
    return { data: null, error: new Error("Organization not found") };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: org.id,
    permission: "create",
  });

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

export async function deleteCourse(params: {
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<Course>> {
  const { data: course, error: findError } = await safeAsync(() =>
    prisma.course.findUnique({
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
    permission: "delete",
  });

  if (!hasPermission) {
    return { data: null, error: new Error("Forbidden") };
  }

  const { error } = await safeAsync(() =>
    prisma.course.delete({
      where: { id: course.id },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: course, error: null };
}
