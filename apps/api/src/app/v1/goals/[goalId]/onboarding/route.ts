import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { NextResponse } from "next/server";

/** The screens still ahead in a new goal's onboarding. */
async function getGoalOnboarding(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/onboarding">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getOnboarding({ goalId: path.data.goalId });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return result.status === "ready" ? NextResponse.json(result.onboarding) : errors.notFound();
}

export const GET = withApiErrorBoundary(getGoalOnboarding);
