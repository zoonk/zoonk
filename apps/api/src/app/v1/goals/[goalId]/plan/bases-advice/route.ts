import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getPlanBasesAdvice } from "@zoonk/core/plans/bases-advice";
import { NextResponse } from "next/server";

/**
 * What the app recommends for the plan's bases, when the learner asks for it ("Get a
 * recommendation"): it plans the goal with every base in depth, so it's a POST a learner sends,
 * never a read a page or prefetch makes.
 */
async function adviseOnBases(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/plan/bases-advice">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getPlanBasesAdvice(path.data.goalId);

  return result.status === "ready" ? NextResponse.json(result.advice) : accessError(result.status);
}

export const POST = withApiErrorBoundary(adviseOnBases);
