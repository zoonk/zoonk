import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planTimeAdviceInputSchema } from "@/lib/openapi/schemas/time-advice";
import { readBody, readPathParams } from "@/lib/request-input";
import { getPlanTimeAdvice } from "@zoonk/core/plans/time-advice";
import { NextResponse } from "next/server";

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
