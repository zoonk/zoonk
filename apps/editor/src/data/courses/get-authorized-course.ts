import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type CourseGetPayload, getActiveCourseWhere, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

const courseWithOrganizationSlug = {
  include: {
    organization: {
      select: {
        slug: true,
      },
    },
  },
} as const;

type CourseWithOrganizationSlug = CourseGetPayload<typeof courseWithOrganizationSlug>;
type AuthorizedCourseWithOrganization = Omit<CourseWithOrganizationSlug, "organization"> & {
  organization: NonNullable<CourseWithOrganizationSlug["organization"]>;
};

/**
 * Authorization needs the same guard rails regardless of whether the caller
 * accepts archived courses, so this helper centralizes the null checks and the
 * permission lookup and guarantees downstream code always receives an org slug.
 */
async function toAuthorizedCourseResult(params: {
  course: CourseWithOrganizationSlug | null;
  error: Error | null;
  headers?: Headers;
}): Promise<SafeReturn<AuthorizedCourseWithOrganization>> {
  const { course, error, headers } = params;

  if (error) {
    return { data: null, error };
  }

  if (!course) {
    return { data: null, error: new AppError(ErrorCode.courseNotFound) };
  }

  if (!course.organization) {
    return { data: null, error: new AppError(ErrorCode.organizationNotFound) };
  }

  const hasPermission = await hasCoursePermission({
    headers,
    orgId: course.organizationId,
    permission: "update",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  return {
    data: {
      ...course,
      organization: course.organization,
    },
    error: null,
  };
}

const cachedGetAuthorizedCourse = cache(
  async (
    courseId: number,
    headers?: Headers,
  ): Promise<SafeReturn<AuthorizedCourseWithOrganization>> => {
    const { data: course, error } = await safeAsync(() =>
      prisma.course.findUnique({
        ...courseWithOrganizationSlug,
        where: { id: courseId },
      }),
    );

    return toAuthorizedCourseResult({
      course,
      error,
      headers,
    });
  },
);

/**
 * Course mutations receive a client-provided course id, so this helper exists to
 * resolve the canonical course record on the server and confirm the caller can
 * still update that course before any mutation or derived path uses its data.
 * Wrapping the lookup in React cache deduplicates repeated authorization reads
 * for the same course within a single request.
 */
export function getAuthorizedCourse(params: {
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<AuthorizedCourseWithOrganization>> {
  return cachedGetAuthorizedCourse(params.courseId, params.headers);
}

const cachedGetAuthorizedActiveCourse = cache(
  async (
    courseId: number,
    headers?: Headers,
  ): Promise<SafeReturn<AuthorizedCourseWithOrganization>> => {
    const { data: course, error } = await safeAsync(() =>
      prisma.course.findFirst({
        ...courseWithOrganizationSlug,
        where: getActiveCourseWhere({ id: courseId }),
      }),
    );

    return toAuthorizedCourseResult({
      course,
      error,
      headers,
    });
  },
);

/**
 * Some course write paths should treat archived courses as unavailable, so this
 * helper preserves the shared authorization behavior while enforcing the active
 * course filter those mutations already rely on. React cache keeps repeated
 * authorized reads for the same active course from re-running in one request.
 */
export function getAuthorizedActiveCourse(params: {
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<AuthorizedCourseWithOrganization>> {
  return cachedGetAuthorizedActiveCourse(params.courseId, params.headers);
}
