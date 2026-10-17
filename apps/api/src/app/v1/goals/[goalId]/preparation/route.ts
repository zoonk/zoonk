import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getGoalPreparation } from "@zoonk/core/preparation/get-goal";
import { NextResponse } from "next/server";

/** Returns the goal's preparation view model. */
async function getPreparation(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/preparation">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getGoalPreparation(path.data.goalId);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(result.preparation);
}

export const GET = withApiErrorBoundary(getPreparation);
