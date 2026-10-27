import { withApiErrorBoundary } from "@/lib/api-handler";
import { toNextLessonResponse } from "@/lib/api-handlers/next-lesson";
import { readChapterContext } from "@/lib/chapter-context";
import { getCatalogChapterNextLesson } from "@zoonk/core/catalog/next-lesson";

/**
 * Returns where the learner goes next in a chapter, read in the course from the
 * query or in the chapter's home course.
 */
async function getChapterNextLesson(
  request: Request,
  context: RouteContext<"/v1/chapters/[chapterId]/next-lesson">,
) {
  const parsed = await readChapterContext({ context, request });

  return toNextLessonResponse(await getCatalogChapterNextLesson(parsed));
}

export const GET = withApiErrorBoundary(getChapterNextLesson);
