import "server-only";

import { type Course, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";
import { hasCoursePermission } from "../organizations";
import { getOrganization } from "../organizations/get-organization";
import type { ContentVisibility } from "../types";

export const getCourse = cache(
  async (params: {
    courseSlug: string;
    language: string;
    orgSlug: string;
    visibility: ContentVisibility;
    headers?: Headers;
  }): Promise<SafeReturn<Course | null>> => {
    const permission = params.visibility === "published" ? "read" : "update";

    const { data, error } = await safeAsync(() =>
      Promise.all([
        hasCoursePermission({
          headers: params.headers,
          orgSlug: params.orgSlug,
          permission,
        }),
        getOrganization(params.orgSlug),
        prisma.course.findFirst({
          where: {
            language: params.language,
            organization: { slug: params.orgSlug },
            slug: params.courseSlug,
          },
        }),
      ]),
    );

    if (error) {
      return { data: null, error };
    }

    const [hasPermission, { data: org }, course] = data;

    if (!course) {
      return { data: null, error: null };
    }

    const isBrandOrg = org?.kind === "brand";
    const canAccess = hasPermission || (course.isPublished && isBrandOrg);

    if (!canAccess) {
      return { data: null, error: new Error("Forbidden") };
    }

    return { data: course, error: null };
  },
);
