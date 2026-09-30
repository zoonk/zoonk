import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getCatalogCourseProgress } from "@zoonk/core/catalog/progress";
import { NextResponse } from "next/server";

/**
 * Returns the learner's progress in a validated course.
 */
async function getCourseProgress(
  _request: Request,
  context: RouteContext<"/v1/courses/[courseId]/progress">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const progress = await getCatalogCourseProgress({ courseId: parsed.data.courseId });

  if (!progress) {
    return errors.notFound();
  }

  return NextResponse.json(progress);
}

export const GET = withApiErrorBoundary(getCourseProgress);
