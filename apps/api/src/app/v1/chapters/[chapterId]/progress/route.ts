import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { chapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getCatalogChapterProgress } from "@zoonk/core/catalog/progress";
import { NextResponse } from "next/server";

/**
 * Returns the learner's progress in a validated chapter.
 */
async function getChapterProgress(
  _request: Request,
  context: RouteContext<"/v1/chapters/[chapterId]/progress">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: chapterPathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const progress = await getCatalogChapterProgress({ chapterId: parsed.data.chapterId });

  if (!progress) {
    return errors.notFound();
  }

  return NextResponse.json(progress);
}

export const GET = withApiErrorBoundary(getChapterProgress);
