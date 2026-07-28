import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { chapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getChapterProgressResource } from "@zoonk/core/progress/get-chapter";
import { NextResponse } from "next/server";

/**
 * Returns progress for a validated chapter resource.
 */
async function getChapterProgress(
  _request: Request,
  context: RouteContext<"/v1/chapters/[chapterId]/progress">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: chapterPathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const progress = await getChapterProgressResource({ chapterId: parsed.data.chapterId });

  if (!progress) {
    return errors.notFound();
  }

  return NextResponse.json(progress);
}

export const GET = withApiErrorBoundary(getChapterProgress);
