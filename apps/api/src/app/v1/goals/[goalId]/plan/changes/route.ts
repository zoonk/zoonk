import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planChangeInvalid } from "@/lib/plan-errors";
import { readBody, readPathParams } from "@/lib/request-input";
import { scheduleGoalPreparation } from "@/lib/session-preparation";
import { changeGoalPlan } from "@zoonk/core/plans/change";
import { planChangeInputSchema } from "@zoonk/core/plans/contract";
import { type NextRequest, NextResponse } from "next/server";

async function createChange(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/plan/changes">,
) {
  const [body, path] = await Promise.all([
    readBody(request, planChangeInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await changeGoalPlan({ goalId: path.goalId, input: body });

  if (result.status === "invalid") {
    return planChangeInvalid(result);
  }

  if (result.status === "unchanged") {
    return NextResponse.json({ change: null, reason: result.reason, status: result.status });
  }

  if (result.status !== "applied") {
    return accessError(result.status);
  }

  await scheduleGoalPreparation(path.goalId);

  return NextResponse.json({ change: result.change, reason: null, status: result.status });
}

export const POST = withApiErrorBoundary(createChange);
