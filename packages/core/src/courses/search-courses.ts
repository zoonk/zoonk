import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { normalizeString } from "@zoonk/utils/string";
import { cache } from "react";
import { getOrganization } from "../orgs/get-org";
import { hasCoursePermission } from "../orgs/org-permissions";
import type { ContentVisibility } from "../types";

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
