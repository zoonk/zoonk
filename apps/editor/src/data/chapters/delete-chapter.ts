import "server-only";
import { ErrorCode } from "@/lib/app-error";
import { hasCoursePermission } from "@zoonk/core/orgs/permissions";
import { type Chapter, prisma } from "@zoonk/db";
import { AppError, type SafeReturn, safeAsync } from "@zoonk/utils/error";
import { getArchivedSlug, getCurriculumDeletePlan } from "../curriculum-delete";

/**
 * Deletes untouched draft chapters, but archives chapters once learner history
 * exists under them so the delete action no longer cascades through that history.
 */
export async function deleteChapter(params: {
  chapterId: string;
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
    return { data: null, error: new AppError(ErrorCode.chapterNotFound) };
  }

  const deletePlan = await getCurriculumDeletePlan({
    isPublished: chapter.isPublished,
    target: {
      chapter,
      entityType: "chapter",
    },
  });

  const hasPermission = await hasCoursePermission({
    headers: params.headers,
    orgId: chapter.organizationId,
    permission: deletePlan.permission,
  });

  if (!hasPermission) {
    return { data: null, error: new AppError(ErrorCode.forbidden) };
  }

  const { data: deletedChapter, error } = await safeAsync(() =>
    removeChapter({
      chapter,
      mode: deletePlan.mode,
    }),
  );

  if (error || !deletedChapter) {
    return { data: null, error };
  }

  return { data: deletedChapter, error: null };
}

/**
 * Switches chapter deletes to archive mode when the lifecycle plan says the
 * subtree contains protected learner history.
 */
function removeChapter({
  chapter,
  mode,
}: {
  chapter: Chapter;
  mode: Awaited<ReturnType<typeof getCurriculumDeletePlan>>["mode"];
}) {
  if (mode === "archive") {
    return prisma.chapter.update({
      data: {
        archivedAt: new Date(),
        slug: getArchivedSlug({
          id: chapter.id,
          slug: chapter.slug,
        }),
      },
      where: { id: chapter.id },
    });
  }

  return prisma.chapter.delete({
    where: { id: chapter.id },
  });
}
