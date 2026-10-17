import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toChapterResource } from "@/lib/catalog-responses";
import { parseChapterContext } from "@/lib/chapter-context";
import { getCatalogChapter } from "@zoonk/core/catalog/chapter";
import { NextResponse } from "next/server";

/**
 * Returns one chapter as a course the viewer can open places it: the course
 * from the query, or the chapter's home course.
 */
async function getChapter(request: Request, context: RouteContext<"/v1/chapters/[chapterId]">) {
  const parsed = parseChapterContext({ params: await context.params, request });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const chapter = await getCatalogChapter(parsed.data);

  if (!chapter) {
    return errors.notFound("Chapter not found");
  }

  return NextResponse.json(toChapterResource(chapter));
}

export const GET = withApiErrorBoundary(getChapter);
