import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toCourseChapter } from "@/lib/catalog-responses";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { listCatalogCourseChapters } from "@zoonk/core/catalog/course-chapters";
import { NextResponse } from "next/server";

async function listCourseChapterResources(
  _request: Request,
  context: RouteContext<"/v1/courses/[courseId]/chapters">,
) {
  const path = await readPathParams(context, coursePathParamsSchema);

  const chapters = await listCatalogCourseChapters({ courseId: path.courseId });

  if (!chapters) {
    return errors.notFound("Course not found");
  }

  return NextResponse.json({ data: chapters.map((chapter) => toCourseChapter(chapter)) });
}

export const GET = withApiErrorBoundary(listCourseChapterResources);
