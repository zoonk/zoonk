import "server-only";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { ensureLocaleSuffix, removeLocaleSuffix, toSlug } from "@zoonk/utils/string";
import { cache } from "react";
import { getAuthorizedActiveCourse } from "./get-authorized-course";

const cachedCourseSlugExists = cache(
  async (orgSlug: string, slug: string, language: string): Promise<boolean> => {
    const { data } = await safeAsync(() =>
      Promise.all([
        prisma.course.findFirst({
          where: { organization: { slug: orgSlug }, slug },
        }),
        prisma.courseAlternativeTitle.findUnique({
          where: { languageSlug: { language, slug: removeLocaleSuffix(slug, language) } },
        }),
      ]),
    );

    if (!data) {
      return false;
    }

    const [course, altTitle] = data;
    return Boolean(course) || (orgSlug === AI_ORG_SLUG && Boolean(altTitle));
  },
);

/**
 * AI-managed courses reserve locale-suffixed slugs, while every other
 * organization stores the plain normalized slug. This helper keeps the editor's
 * availability checks aligned with the slug that the save path will persist.
 */
function normalizeCourseSlug(params: { language: string; orgSlug: string; slug: string }): string {
  const normalizedSlug = toSlug(params.slug);

  if (params.orgSlug !== AI_ORG_SLUG) {
    return normalizedSlug;
  }

  return ensureLocaleSuffix(normalizedSlug, params.language);
}

/**
 * Course creation checks receive an org slug before a course exists, so this
 * helper verifies the caller can create courses in that organization before it
 * asks whether the normalized slug is already reserved there.
 */
export async function courseSlugExistsForCreate(params: {
  headers?: Headers;
  language: string;
  orgSlug: string;
  slug: string;
}): Promise<boolean> {
  if (!params.slug.trim()) {
    return false;
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgSlug: params.orgSlug,
    permission: "create",
  });

  if (!hasPermission) {
    return false;
  }

  return cachedCourseSlugExists(params.orgSlug, normalizeCourseSlug(params), params.language);
}

/**
 * Course rename checks should not trust a client-provided org slug, so this
 * helper re-resolves the active course by id and uses the authorized
 * organization scope for the duplicate lookup.
 */
export async function courseSlugExistsForUpdate(params: {
  courseId: number;
  headers?: Headers;
  slug: string;
}): Promise<boolean> {
  if (!params.slug.trim()) {
    return false;
  }

  const { data: course, error } = await getAuthorizedActiveCourse({
    courseId: params.courseId,
    headers: params.headers,
  });

  if (error) {
    return false;
  }

  return cachedCourseSlugExists(
    course.organization.slug,
    normalizeCourseSlug({
      language: course.language,
      orgSlug: course.organization.slug,
      slug: params.slug,
    }),
    course.language,
  );
}
