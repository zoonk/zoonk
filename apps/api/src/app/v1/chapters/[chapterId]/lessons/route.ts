import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toChapterLessons } from "@/lib/catalog-responses";
import { parseChapterContext } from "@/lib/chapter-context";
import { listCatalogChapterLessons } from "@zoonk/core/catalog/chapter-lessons";
import { NextResponse } from "next/server";

/**
 * Lists one chapter's lessons in order, read in the course from the query or
 * in the chapter's home course.
 */
async function listChapterLessonResources(
  request: Request,
  context: RouteContext<"/v1/chapters/[chapterId]/lessons">,
) {
  const parsed = parseChapterContext({ params: await context.params, request });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const chapterLessons = await listCatalogChapterLessons(parsed.data);

  if (!chapterLessons) {
    return errors.notFound("Chapter not found");
  }

  return NextResponse.json({ data: toChapterLessons(chapterLessons) });
}

export const GET = withApiErrorBoundary(listChapterLessonResources);
