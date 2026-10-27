import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getCatalogCourseProgress } from "@zoonk/core/catalog/progress";
import { NextResponse } from "next/server";

/**
 * Returns the learner's progress in a validated course.
 */
async function getCourseProgress(
  _request: Request,
  context: RouteContext<"/v1/courses/[courseId]/progress">,
) {
  const parsed = await readPathParams(context, coursePathParamsSchema);

  const progress = await getCatalogCourseProgress({ courseId: parsed.courseId });

  if (!progress) {
    return errors.notFound();
  }

  return NextResponse.json(progress);
}

export const GET = withApiErrorBoundary(getCourseProgress);
