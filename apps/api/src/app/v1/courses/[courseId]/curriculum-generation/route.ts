import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getCourseCurriculumGenerationView } from "@zoonk/core/workflows/course-curriculum-generation-access";
import { NextResponse } from "next/server";

async function getView(
  _request: Request,
  context: RouteContext<"/v1/courses/[courseId]/curriculum-generation">,
) {
  const path = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getCourseCurriculumGenerationView(path.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound("Course not found");
  }

  const course = result.course;

  return NextResponse.json({
    course: {
      contentRevision: course.contentRevision,
      curriculumVersion: course.curriculumVersion,
      format: course.format,
      generationId: course.generationRunId,
      generationStatus: course.generationStatus,
      id: course.id,
      title: course.title,
    },
    needsGeneration: result.needsGeneration,
    status: "ready",
  });
}
export const GET = withApiErrorBoundary(getView);
