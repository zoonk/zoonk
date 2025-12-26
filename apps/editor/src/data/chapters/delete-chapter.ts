import "server-only";

import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { type SafeReturn, safeAsync } from "@zoonk/utils/error";

export async function deleteChapter(params: {
  chapterId: number;
  headers?: Headers;
}): Promise<SafeReturn<Chapter>> {
  const { data: chapter, error: findError } = await safeAsync(() =>
    prisma.chapter.findUnique({
      where: { id: params.chapterId },
    }),
  );

  if (findError) {
    return { data: null, error: findError };
  }

  if (!chapter) {
    return { data: null, error: new Error("Chapter not found") };
  }

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: chapter.organizationId,
    permission: "delete",
  });

  if (!hasPermission) {
    return { data: null, error: new Error("Forbidden") };
  }

  const { error } = await safeAsync(() =>
    prisma.chapter.delete({
      where: { id: chapter.id },
    }),
  );

  if (error) {
    return { data: null, error };
  }

  return { data: chapter, error: null };
}
