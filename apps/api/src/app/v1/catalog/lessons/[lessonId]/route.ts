import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toCatalogLesson } from "@/lib/catalog-responses";
import { catalogLessonQuerySchema } from "@/lib/openapi/schemas/catalog-resources";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { getCatalogLesson } from "@zoonk/core/catalog/lesson";
import { NextResponse } from "next/server";

async function getCatalogLessonRoute(
  request: Request,
  context: RouteContext<"/v1/catalog/lessons/[lessonId]">,
) {
  const path = await readPathParams(context, lessonPathParamsSchema);
  const query = readQueryParams(request, catalogLessonQuerySchema);

  const lesson = await getCatalogLesson({ courseId: query.courseId, lessonId: path.lessonId });

  if (!lesson) {
    return errors.notFound("Lesson not found");
  }

  return NextResponse.json(toCatalogLesson(lesson));
}

export const GET = withApiErrorBoundary(getCatalogLessonRoute);
