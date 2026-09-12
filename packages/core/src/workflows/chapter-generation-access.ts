import "server-only";
import { getChapterForGeneration } from "../chapters/get-chapter-for-generation";
import { getSession } from "../users/get-session";

/** A pending row with saved lessons is a status repair, while running and completed rows are resumptions. */
function shouldClaimChapterGenerationQuota(
  chapter: NonNullable<Awaited<ReturnType<typeof getChapterForGeneration>>>,
): boolean {
  const canGenerate =
    chapter.generationStatus === "pending" || chapter.generationStatus === "failed";

  return canGenerate && chapter._count.lessons === 0;
}

/** Determines whether an authorized explicit request still needs AI work. */
async function getAuthenticatedChapterGenerationAccess(
  chapter: NonNullable<Awaited<ReturnType<typeof getChapterForGeneration>>>,
) {
  return {
    chapter,
    shouldClaimQuota: shouldClaimChapterGenerationQuota(chapter),
    status: "ready" as const,
  };
}

/**
 * Requires a trusted learner before allowing a delivery app to start generation.
 */
export async function getChapterGenerationAccess(chapterId: string) {
  const [chapter, session] = await Promise.all([getChapterForGeneration(chapterId), getSession()]);

  if (!session) {
    return { status: "unauthorized" as const };
  }

  if (!chapter) {
    return { status: "notFound" as const };
  }

  return getAuthenticatedChapterGenerationAccess(chapter);
}

/**
 * Preserves public redirects for completed chapters while requiring a
 * trusted learner before the page can mount a client that starts or resumes
 * generation. The read remains uncached because generation pages disable
 * prefetching and API handlers do not repeat it.
 */
export async function getChapterGenerationView(chapterId: string) {
  const [chapter, session] = await Promise.all([getChapterForGeneration(chapterId), getSession()]);

  if (!chapter) {
    return { status: "notFound" as const };
  }

  if (!session) {
    const canRedirectToPublicChapter =
      chapter.generationStatus === "completed" && chapter._count.lessons > 0;

    if (!canRedirectToPublicChapter) {
      return {
        chapterSlug: chapter.slug,
        courseSlug: chapter.course.slug,
        status: "unauthorized" as const,
      };
    }

    return { chapter, shouldClaimQuota: false, status: "ready" as const };
  }

  return getAuthenticatedChapterGenerationAccess(chapter);
}
