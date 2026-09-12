import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toLearningPath } from "@/lib/learning-plan-responses";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getCourseLearningPath } from "@zoonk/core/courses/learning-plan";
import { NextResponse } from "next/server";

async function getPath(
  _request: Request,
  context: RouteContext<"/v1/courses/[courseId]/learning-path">,
) {
  const path = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getCourseLearningPath(path.data);

  if (result.status === "notFound") {
    return errors.notFound("Course not found");
  }

  if (result.status === "invalid") {
    return errors.unprocessableEntity("Saved course preferences are unavailable");
  }

  return NextResponse.json(toLearningPath(result));
}

export const GET = withApiErrorBoundary(getPath);
