import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planTimeToCoverInputSchema } from "@/lib/openapi/schemas/time-advice";
import { readBody, readPathParams } from "@/lib/request-input";
import { findPlanTimeToCover } from "@zoonk/core/plans/time-advice";
import { type NextRequest, NextResponse } from "next/server";

async function findTimeToCover(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/plan/time-to-cover">,
) {
  const [body, path] = await Promise.all([
    readBody(request, planTimeToCoverInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await findPlanTimeToCover({
    goalId: path.goalId,
    input: { studyDays: body.studyDays, weekendMinutes: body.weekendMinutes },
  });

  return result.status === "ready" ? NextResponse.json(result.time) : accessError(result.status);
}

export const POST = withApiErrorBoundary(findTimeToCover);
