import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toCourseChapter } from "@/lib/catalog-responses";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { listCatalogCourseChapters } from "@zoonk/core/catalog/course-chapters";
import { NextResponse } from "next/server";

/**
 * Lists the chapters of a published brand course, or of the signed-in
 * learner's own private course, in reading order from overview to advanced.
 */
async function listCourseChapterResources(
  _request: Request,
  context: RouteContext<"/v1/courses/[courseId]/chapters">,
) {
  const path = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const chapters = await listCatalogCourseChapters({ courseId: path.data.courseId });

  if (!chapters) {
    return errors.notFound("Course not found");
  }

  return NextResponse.json({ data: chapters.map((chapter) => toCourseChapter(chapter)) });
}

export const GET = withApiErrorBoundary(listCourseChapterResources);
