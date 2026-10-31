import { withApiErrorBoundary } from "@/lib/api-handler";
import { toNextLessonResponse } from "@/lib/api-handlers/next-lesson";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getCatalogCourseNextLesson } from "@zoonk/core/catalog/next-lesson";

async function getCourseNextLesson(
  _request: Request,
  context: RouteContext<"/v1/courses/[courseId]/next-lesson">,
) {
  const parsed = await readPathParams(context, coursePathParamsSchema);

  return toNextLessonResponse(await getCatalogCourseNextLesson({ courseId: parsed.courseId }));
}

export const GET = withApiErrorBoundary(getCourseNextLesson);
