import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getPlanBasesAdvice } from "@zoonk/core/plans/bases-advice";
import { NextResponse } from "next/server";

async function adviseOnBases(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/plan/bases-advice">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getPlanBasesAdvice(path.goalId);

  return result.status === "ready" ? NextResponse.json(result.advice) : accessError(result.status);
}

export const POST = withApiErrorBoundary(adviseOnBases);
