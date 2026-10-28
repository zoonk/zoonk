import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { chapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getCatalogChapterProgress } from "@zoonk/core/catalog/progress";
import { NextResponse } from "next/server";

async function getChapterProgress(
  _request: Request,
  context: RouteContext<"/v1/chapters/[chapterId]/progress">,
) {
  const parsed = await readPathParams(context, chapterPathParamsSchema);

  const progress = await getCatalogChapterProgress({ chapterId: parsed.chapterId });

  if (!progress) {
    return errors.notFound();
  }

  return NextResponse.json(progress);
}

export const GET = withApiErrorBoundary(getChapterProgress);
