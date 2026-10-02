import { accessError, createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { planChangeInvalid, planErrorCodes } from "@/lib/plan-errors";
import { planEditRequestInputSchema } from "@zoonk/core/plans/contract";
import { requestPlanEdit } from "@zoonk/core/plans/request-edit";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Changes the plan from the learner's plain words. Small changes apply with an undo; bigger ones
 * come back proposed, with their effect, waiting for the learner's OK.
 */
async function createEditRequest(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/plan/edit-requests">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, planEditRequestInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await requestPlanEdit({ goalId: path.data.goalId, input: body.data });

  if (result.status === "notUnderstood") {
    return createErrorResponse({
      code: planErrorCodes.planEditNotUnderstood,
      message: "That doesn't read as a change to the plan",
      status: httpStatus.unprocessableEntity,
    });
  }

  if (result.status === "invalid") {
    return planChangeInvalid(result.error);
  }

  if (result.status === "applied" || result.status === "proposed") {
    return NextResponse.json({ change: result.change, status: result.status });
  }

  if (result.status === "limitReached" || result.status === "slowDown") {
    return usageDecisionError(result);
  }

  return accessError(result.status);
}

export const POST = withApiErrorBoundary(createEditRequest);
