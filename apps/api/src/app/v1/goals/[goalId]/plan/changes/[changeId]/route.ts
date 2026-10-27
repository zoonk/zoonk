import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { planChangePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planChangeConflict, planChangeInvalid } from "@/lib/plan-errors";
import { readBody, readPathParams } from "@/lib/request-input";
import { scheduleGoalPreparation } from "@/lib/session-preparation";
import { planChangeDecisionInputSchema } from "@zoonk/core/plans/contract";
import { decidePlanChange } from "@zoonk/core/plans/decide-change";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Accepts or declines a proposed change, undoes an applied one, or marks it seen ("Got it"). A
 * decision that changes the plan starts writing what it has soon, as a session's preparation does:
 * Carla's added case study waited, never outlined, for a lesson she would start.
 */
async function decideChange(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/plan/changes/[changeId]">,
) {
  const [body, path] = await Promise.all([
    readBody(request, planChangeDecisionInputSchema),
    readPathParams(context, planChangePathParamsSchema),
  ]);

  const result = await decidePlanChange({
    changeId: path.changeId,
    goalId: path.goalId,
    input: body,
  });

  if (result.status === "invalid") {
    return planChangeInvalid(result);
  }

  if (result.status === "conflict") {
    return planChangeConflict();
  }

  if (result.status !== "updated") {
    return accessError(result.status);
  }

  if (body.status === "applied" || body.status === "undone") {
    await scheduleGoalPreparation(path.goalId);
  }

  return NextResponse.json(result.change);
}

export const POST = withApiErrorBoundary(decideChange);
