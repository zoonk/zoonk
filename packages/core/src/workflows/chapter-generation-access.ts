import "server-only";
import { hasActiveSubscription } from "../auth/subscription";
import { getChapterForGeneration } from "../chapters/get-chapter-for-generation";

/**
 * Applies the existing first-chapter subscription rule to an AI-owned chapter
 * before a delivery app starts its generation workflow.
 */
export async function getChapterGenerationAccess(chapterId: string) {
  const chapter = await getChapterForGeneration(chapterId);

  if (!chapter) {
    return { status: "notFound" as const };
  }

  if (chapter.position !== 0 && !(await hasActiveSubscription())) {
    return { chapter, status: "subscriptionRequired" as const };
  }

  return { chapter, status: "ready" as const };
}

/**
 * Resolves the chapter-generation view without caching it because generation
 * pages disable prefetching and API handlers do not repeat this read.
 */
export async function getChapterGenerationView(chapterId: string) {
  return getChapterGenerationAccess(chapterId);
}
