import { getChapterGenerationView } from "@zoonk/core/workflows/chapter-generation-access";
import { getLessonGenerationView } from "@zoonk/core/workflows/lesson-generation-view";
import { type getContinueLessonTarget } from "./get-catalog-target";

/** An explicit Continue can prepare its target when Core confirms generation is supported. */
export async function getPendingGenerationHref(
  data: Awaited<ReturnType<typeof getContinueLessonTarget>>,
) {
  if (!data || data.completed || data.canPrefetch) {
    return null;
  }

  if ("lessonId" in data) {
    const view = await getLessonGenerationView(data.lessonId);

    return view.status === "unauthorized" ||
      view.status === "redirectToSource" ||
      (view.status === "ready" && !view.isReadyForRedirect)
      ? (`/generate/l/${data.lessonId}` as const)
      : null;
  }

  const view = await getChapterGenerationView(data.chapterId);

  return view.status === "unauthorized" ||
    (view.status === "ready" && view.chapter.generationStatus !== "completed")
    ? (`/generate/ch/${data.chapterId}` as const)
    : null;
}
