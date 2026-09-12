import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { toLearningPath } from "@/lib/learning-plan-responses";
import { startCourseBodySchema } from "@/lib/openapi/schemas/learning-plan";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { startCurrentUserCourse } from "@zoonk/core/courses/learning-plan";
import { type NextRequest, NextResponse } from "next/server";

async function startCourse(
  request: NextRequest,
  context: RouteContext<"/v1/me/courses/[courseId]/start">,
) {
  const path = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, startCourseBodySchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await startCurrentUserCourse({ ...path.data, ...body.data });

  if (result.status === "limitReached") {
    return errors.generationLimitReached(result.limit);
  }

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound("Course not found");
  }

  if (result.status === "invalid") {
    return errors.unprocessableEntity("Choose a valid course level, goal, and lesson format");
  }

  if (result.status === "conflict") {
    return errors.conflict("The learning plan changed; reload before starting");
  }

  return NextResponse.json(result.status === "ready" ? toLearningPath(result) : result);
}

export const POST = withApiErrorBoundary(startCourse);
