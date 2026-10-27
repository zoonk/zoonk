import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getGoalPreparation } from "@zoonk/core/preparation/get-goal";
import { NextResponse } from "next/server";

/** Returns the goal's preparation view model. */
async function getPreparation(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/preparation">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getGoalPreparation(path.goalId);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(result.preparation);
}

export const GET = withApiErrorBoundary(getPreparation);
