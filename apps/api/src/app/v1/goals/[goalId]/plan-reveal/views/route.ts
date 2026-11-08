import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { markPlanRevealed } from "@zoonk/core/goals/mark-plan-revealed";

async function createView(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/plan-reveal/views">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);
  const result = await markPlanRevealed(path.goalId);

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  return new Response(null, { status: 204 });
}

export const POST = withApiErrorBoundary(createView);
