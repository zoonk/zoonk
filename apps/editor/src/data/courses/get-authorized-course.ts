import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type CourseGetPayload, getActiveCourseWhere, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";

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

/**
 * Course mutations receive a client-provided course id, so this helper exists to
 * resolve the canonical course record on the server and confirm the caller can
 * still update that course before any mutation or derived path uses its data.
 */
export async function getAuthorizedCourse(params: {
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<AuthorizedCourseWithOrganization>> {
  const { data: course, error } = await safeAsync(() =>
    prisma.course.findUnique({
      ...courseWithOrganizationSlug,
      where: { id: params.courseId },
    }),
  );

  return toAuthorizedCourseResult({
    course,
    error,
    headers: params.headers,
  });
}

/**
 * Some course write paths should treat archived courses as unavailable, so this
 * helper preserves the shared authorization behavior while enforcing the active
 * course filter those mutations already rely on.
 */
export async function getAuthorizedActiveCourse(params: {
  courseId: number;
  headers?: Headers;
}): Promise<SafeReturn<AuthorizedCourseWithOrganization>> {
  const { data: course, error } = await safeAsync(() =>
    prisma.course.findFirst({
      ...courseWithOrganizationSlug,
      where: getActiveCourseWhere({ id: params.courseId }),
    }),
  );

  return toAuthorizedCourseResult({
    course,
    error,
    headers: params.headers,
  });
}
