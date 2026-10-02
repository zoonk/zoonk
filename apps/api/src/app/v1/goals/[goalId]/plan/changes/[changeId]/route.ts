import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { planChangePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { planChangeConflict, planChangeInvalid } from "@/lib/plan-errors";
import { planChangeDecisionInputSchema } from "@zoonk/core/plans/contract";
import { decidePlanChange } from "@zoonk/core/plans/decide-change";
import { type NextRequest, NextResponse } from "next/server";

/** Accepts or declines a proposed change, or undoes an applied one. */
async function decideChange(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/plan/changes/[changeId]">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, planChangeDecisionInputSchema),
    context.params.then((params) =>
      parsePathParams({ params, schema: planChangePathParamsSchema }),
    ),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await decidePlanChange({
    changeId: path.data.changeId,
    goalId: path.data.goalId,
    input: body.data,
  });

  if (result.status === "invalid") {
    return planChangeInvalid(result.error);
  }

  if (result.status === "conflict") {
    return planChangeConflict();
  }

  if (result.status !== "updated") {
    return accessError(result.status);
  }

  return NextResponse.json(result.change);
}

export const PATCH = withApiErrorBoundary(decideChange);
