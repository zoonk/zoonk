import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { normalizeString, toSlug } from "@zoonk/utils/string";
import { getOrganization } from "../orgs/get-org";
import { hasCoursePermission } from "../orgs/org-permissions";
import { getSession } from "../users/get-user-session";

export async function createCourse(params: {
  description: string;
  language: string;
  orgSlug: string;
  slug: string;
  title: string;
  headers?: Headers;
}): Promise<SafeReturn<Course>> {
  const session = await getSession({ headers: params.headers });

  if (!session) {
    return { data: null, error: new Error("Unauthorized") };
  }

  const { data: org } = await getOrganization(params.orgSlug);

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
