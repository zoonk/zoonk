import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toChapterResource } from "@/lib/catalog-responses";
import { chapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getChapterById } from "@zoonk/core/chapters/get-by-id";
import { NextResponse } from "next/server";

/**
 * Returns the canonical metadata for one published chapter.
 */
async function getChapter(_request: Request, context: RouteContext<"/v1/chapters/[chapterId]">) {
  const parsed = parsePathParams({ params: await context.params, schema: chapterPathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const chapter = await getChapterById({ chapterId: parsed.data.chapterId });

  if (!chapter) {
    return errors.notFound("Chapter not found");
  }

  return NextResponse.json(toChapterResource(chapter));
}

export const GET = withApiErrorBoundary(getChapter);
