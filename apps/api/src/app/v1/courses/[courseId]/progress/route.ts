import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { courseProgressQuerySchema } from "@/lib/openapi/schemas/progress";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { getCourseProgressResource } from "@zoonk/core/progress/get-course";
import { NextResponse } from "next/server";

/**
 * Returns progress for a validated course resource.
 */
async function getCourseProgress(
  request: Request,
  context: RouteContext<"/v1/courses/[courseId]/progress">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const query = parseQueryParams(new URL(request.url).searchParams, courseProgressQuerySchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const progress = await getCourseProgressResource({
    courseId: parsed.data.courseId,
    view: query.data.view,
  });

  if (!progress) {
    return errors.notFound();
  }

  return NextResponse.json(progress);
}

export const GET = withApiErrorBoundary(getCourseProgress);
