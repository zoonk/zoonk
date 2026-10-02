import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { planChangeInvalid } from "@/lib/plan-errors";
import { changeGoalPlan } from "@zoonk/core/plans/change";
import { planChangeInputSchema } from "@zoonk/core/plans/contract";
import { type NextRequest, NextResponse } from "next/server";

/** Applies a change the learner made in the plan and re-plans from today, with an undo. */
async function createChange(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/plan/changes">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, planChangeInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await changeGoalPlan({ goalId: path.data.goalId, input: body.data });

  if (result.status === "invalid") {
    return planChangeInvalid(result.error);
  }

  if (result.status !== "applied") {
    return accessError(result.status);
  }

  return NextResponse.json({ change: result.change, status: result.status });
}

export const POST = withApiErrorBoundary(createChange);
