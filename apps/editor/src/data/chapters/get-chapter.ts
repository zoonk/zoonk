import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { cache } from "react";

async function findChapter(params: {
  chapterId?: number;
  chapterSlug?: string;
  orgSlug?: string;
}): Promise<Chapter | null> {
  if (params.chapterId) {
    return prisma.chapter.findUnique({
      where: { id: params.chapterId },
    });
  }

  if (params.chapterSlug && params.orgSlug) {
    return prisma.chapter.findFirst({
      where: {
        organization: { slug: params.orgSlug },
        slug: params.chapterSlug,
      },
    });
  }

  return null;
}

export const getChapter = cache(
  async (params: {
    chapterId?: number;
    chapterSlug?: string;
    headers?: Headers;
    orgSlug?: string;
  }): Promise<SafeReturn<Chapter | null>> => {
    const { data: chapter, error: findError } = await safeAsync(() =>
      findChapter(params),
    );

    if (findError) {
      return { data: null, error: findError };
    }

    if (!chapter) {
      return { data: null, error: null };
    }

    const hasPermission = await hasCoursePermission({
      headers: params.headers,
      orgId: chapter.organizationId,
      permission: "update",
    });

    if (!hasPermission) {
      return { data: null, error: new Error("Forbidden") };
    }

    return { data: chapter, error: null };
  },
);
