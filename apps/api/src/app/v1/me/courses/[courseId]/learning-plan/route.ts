import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { toLearningPlan } from "@/lib/learning-plan-responses";
import { updateLearningPlanBodySchema } from "@/lib/openapi/schemas/learning-plan";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import {
  getCurrentUserCoursePlan,
  updateCurrentUserCoursePlan,
} from "@zoonk/core/courses/learning-plan";
import { type NextRequest, NextResponse } from "next/server";

type Context = RouteContext<"/v1/me/courses/[courseId]/learning-plan">;

function planResponse(
  result:
    | Awaited<ReturnType<typeof getCurrentUserCoursePlan>>
    | Awaited<ReturnType<typeof updateCurrentUserCoursePlan>>,
) {
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
    return errors.conflict("The learning plan changed; reload before saving");
  }

  return NextResponse.json({ plan: toLearningPlan(result.plan) });
}

async function getPlan(_request: Request, context: Context) {
  const path = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  return planResponse(await getCurrentUserCoursePlan(path.data));
}

async function putPlan(request: NextRequest, context: Context) {
  const path = parsePathParams({ params: await context.params, schema: coursePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, updateLearningPlanBodySchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  return planResponse(await updateCurrentUserCoursePlan({ ...path.data, ...body.data }));
}

export const GET = withApiErrorBoundary(getPlan);
export const PUT = withApiErrorBoundary(putPlan);
