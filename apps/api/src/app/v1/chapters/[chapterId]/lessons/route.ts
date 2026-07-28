import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toChapterLesson } from "@/lib/catalog-responses";
import { chapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getChapterById } from "@zoonk/core/chapters/get-by-id";
import { listChapterLessons } from "@zoonk/core/lessons/list-by-chapter";
import { NextResponse } from "next/server";

/**
 * Lists one published chapter's lesson-shell resources in authored order.
 */
async function listChapterLessonResources(
  _request: Request,
  context: RouteContext<"/v1/chapters/[chapterId]/lessons">,
) {
  const path = parsePathParams({ params: await context.params, schema: chapterPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const [chapter, lessons] = await Promise.all([
    getChapterById({ chapterId: path.data.chapterId }),
    listChapterLessons({ chapterId: path.data.chapterId }),
  ]);

  if (!chapter) {
    return errors.notFound("Chapter not found");
  }

  return NextResponse.json({
    data: lessons.map((lesson) => toChapterLesson({ courseId: chapter.courseId, lesson })),
  });
}

export const GET = withApiErrorBoundary(listChapterLessonResources);
