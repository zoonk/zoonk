import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { getOrganization } from "@zoonk/core/orgs/get";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { getSession } from "@zoonk/core/users/session/get";
import { type Course, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";

export async function createCourse(params: {
  description: string;
  headers?: Headers;
  language: string;
  orgSlug: string;
  slug: string;
  title: string;
}): Promise<SafeReturn<Course>> {
  const session = await getSession(params.headers);

  if (!session) {
    return { data: null, error: new AppError(ErrorCode.unauthorized) };
  }

  const { data: org } = await getOrganization(params.orgSlug);

  if (!org) {
    return {
      data: null,
      error: new AppError(ErrorCode.organizationNotFound),
    };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: org.id,
    permission: "create",
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const courseSlug = toSlug(params.slug);
  const normalizedTitle = normalizeString(params.title);

  const { data, error } = await safeAsync(() =>
    prisma.course.create({
      data: {
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
