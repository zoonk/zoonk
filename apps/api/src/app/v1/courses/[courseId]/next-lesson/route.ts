import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toNextLessonResponse } from "@/lib/api-handlers/next-lesson";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getCatalogCourseNextLesson } from "@zoonk/core/catalog/next-lesson";

/**
 * Returns where the learner goes next in a validated course.
 */
async function getCourseNextLesson(
  _request: Request,
  context: RouteContext<"/v1/courses/[courseId]/next-lesson">,
) {
  const parsed = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  return toNextLessonResponse(await getCatalogCourseNextLesson({ courseId: parsed.data.courseId }));
}

export const GET = withApiErrorBoundary(getCourseNextLesson);
