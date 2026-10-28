import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getGoalPlan } from "@zoonk/core/plans/get";
import { getGoalWeekTime } from "@zoonk/core/progress/get-goal-week-time";
import { NextResponse } from "next/server";

/** The goal's plan at every zoom level, with this week's study time for its pace. */
async function readPlan(_request: Request, context: RouteContext<"/v1/goals/[goalId]/plan">) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const [result, week] = await Promise.all([
    getGoalPlan(path.goalId),
    getGoalWeekTime(path.goalId),
  ]);

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  if (week.status !== "ready") {
    return accessError(week.status);
  }

  return NextResponse.json({ ...result.plan, weekTime: week.weekTime });
}

export const GET = withApiErrorBoundary(readPlan);
