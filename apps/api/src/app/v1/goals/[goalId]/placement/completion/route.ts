import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { placementCompletionInputSchema } from "@zoonk/core/learner/placement/contract";
import { finishGoalPlacement } from "@zoonk/core/learner/placement/finish";
import { type NextRequest, NextResponse } from "next/server";

async function completePlacement(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/placement/completion">,
) {
  const [body, path] = await Promise.all([
    readBody(request, placementCompletionInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await finishGoalPlacement({ goalId: path.goalId, input: body });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(result.completion);
}

export const POST = withApiErrorBoundary(completePlacement);
