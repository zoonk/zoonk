import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { clampQueryItems } from "@zoonk/db/utils";
import { safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { getOrganization } from "../orgs/get-org";
import { hasCoursePermission } from "../orgs/org-permissions";
import type { ContentVisibility } from "../types";

export const LIST_COURSES_LIMIT = 20;

export const listCourses = cache(
  async (params: {
    orgSlug: string;
    visibility: ContentVisibility;
    language?: string;
    limit?: number;
    headers?: Headers;
  }): Promise<{ data: Course[]; error: Error | null }> => {
    const permission = params.visibility === "published" ? "read" : "update";

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug: params.orgSlug,
          permission,
        }),
        getOrganization(params.orgSlug),
        prisma.course.findMany({
          orderBy: { createdAt: "desc" },
          take: clampQueryItems(params.limit ?? LIST_COURSES_LIMIT),
          where: {
            organization: { slug: params.orgSlug },
            ...(params.language && { language: params.language }),
            ...(params.visibility === "published" && { isPublished: true }),
            ...(params.visibility === "draft" && { isPublished: false }),
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
      hasPermission || (params.visibility === "published" && isBrandOrg);

    if (!canAccess) {
      return { data: [], error: new Error("Forbidden") };
    }

    return { data: courses, error: null };
  },
);
