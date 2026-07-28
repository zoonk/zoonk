import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toCourseChapter } from "@/lib/catalog-responses";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { listCourseChapters } from "@zoonk/core/chapters/list-by-course";
import { getCourseById } from "@zoonk/core/courses/get-by-id";
import { NextResponse } from "next/server";

/**
 * Lists one published course's chapter resources in authored order.
 */
async function listCourseChapterResources(
  _request: Request,
  context: RouteContext<"/v1/courses/[courseId]/chapters">,
) {
  const path = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const [course, chapters] = await Promise.all([
    getCourseById({ courseId: path.data.courseId }),
    listCourseChapters({ courseId: path.data.courseId }),
  ]);

  if (!course) {
    return errors.notFound("Course not found");
  }

  return NextResponse.json({ data: chapters.map((chapter) => toCourseChapter(chapter)) });
}

export const GET = withApiErrorBoundary(listCourseChapterResources);
