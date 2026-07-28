import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { handleNextLesson } from "@/lib/api-handlers/next-lesson";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";

/**
 * Converts a validated course resource path into a next-lesson scope.
 */
async function getCourseNextLesson(
  _request: Request,
  context: RouteContext<"/v1/courses/[courseId]/next-lesson">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  return handleNextLesson({ scope: { courseId: parsed.data.courseId } });
}

export const GET = withApiErrorBoundary(getCourseNextLesson);
