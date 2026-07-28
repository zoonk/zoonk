import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { handleNextLesson } from "@/lib/api-handlers/next-lesson";
import { chapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";

/**
 * Converts a validated chapter resource path into a next-lesson scope.
 */
async function getChapterNextLesson(
  _request: Request,
  context: RouteContext<"/v1/chapters/[chapterId]/next-lesson">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: chapterPathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  return handleNextLesson({ scope: { chapterId: parsed.data.chapterId } });
}

export const GET = withApiErrorBoundary(getChapterNextLesson);
