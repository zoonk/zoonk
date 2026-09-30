import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getGoalPlan } from "@zoonk/core/plans/get";
import { NextResponse } from "next/server";

/** The goal's plan at every zoom level, the same view model both modes show. */
async function readPlan(_request: Request, context: RouteContext<"/v1/goals/[goalId]/plan">) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getGoalPlan(path.data.goalId);

  return result.status === "ready" ? NextResponse.json(result.plan) : accessError(result.status);
}

export const GET = withApiErrorBoundary(readPlan);
