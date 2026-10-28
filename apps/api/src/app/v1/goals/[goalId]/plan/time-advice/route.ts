import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planTimeAdviceInputSchema } from "@/lib/openapi/schemas/time-advice";
import { readBody, readPathParams } from "@/lib/request-input";
import { getPlanTimeAdvice } from "@zoonk/core/plans/time-advice";
import { NextResponse } from "next/server";

/**
 * What the daily time asked about covers by the goal's date, in the week asked about, studying
 * everything when that's asked for an exam: that time's own plan only. The time that covers
 * everything is the learner's POST (`time-to-cover`).
 */
async function readTimeAdvice(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/plan/time-advice">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const body = await readBody(request, planTimeAdviceInputSchema);

  const result = await getPlanTimeAdvice({ goalId: path.goalId, input: body });

  return result.status === "ready" ? NextResponse.json(result.advice) : accessError(result.status);
}

export const POST = withApiErrorBoundary(readTimeAdvice);
