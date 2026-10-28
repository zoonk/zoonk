import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { NextResponse } from "next/server";

async function getGoalOnboarding(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/onboarding">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getOnboarding({ goalId: path.goalId });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return result.status === "ready" ? NextResponse.json(result.onboarding) : errors.notFound();
}

export const GET = withApiErrorBoundary(getGoalOnboarding);
