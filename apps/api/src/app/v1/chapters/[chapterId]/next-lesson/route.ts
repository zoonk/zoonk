import { withApiErrorBoundary } from "@/lib/api-handler";
import { toNextLessonResponse } from "@/lib/api-handlers/next-lesson";
import { readChapterContext } from "@/lib/chapter-context";
import { getCatalogChapterNextLesson } from "@zoonk/core/catalog/next-lesson";

async function getChapterNextLesson(
  request: Request,
  context: RouteContext<"/v1/chapters/[chapterId]/next-lesson">,
) {
  const parsed = await readChapterContext({ context, request });

  return toNextLessonResponse(await getCatalogChapterNextLesson(parsed));
}

export const GET = withApiErrorBoundary(getChapterNextLesson);
