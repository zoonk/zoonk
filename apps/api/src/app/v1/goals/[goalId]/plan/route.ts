import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getGoalPlan } from "@zoonk/core/plans/get";
import { NextResponse } from "next/server";

/** The goal's plan at every zoom level. */
async function readPlan(_request: Request, context: RouteContext<"/v1/goals/[goalId]/plan">) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getGoalPlan(path.goalId);

  return result.status === "ready" ? NextResponse.json(result.plan) : accessError(result.status);
}

export const GET = withApiErrorBoundary(readPlan);
