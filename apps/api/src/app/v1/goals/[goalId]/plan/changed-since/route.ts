import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planChangedSinceQuerySchema } from "@/lib/openapi/schemas/plan-changed-since";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { getPlanChangedSince } from "@zoonk/core/plans/changed-since";
import { NextResponse } from "next/server";

/** Whether the plan, or Today, changed since the client read it. */
async function readPlanChangedSince(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/plan/changed-since">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const query = readQueryParams(request, planChangedSinceQuerySchema);

  const result = await getPlanChangedSince({
    goalId: path.goalId,
    since: Date.parse(query.since),
    watch: query.watch,
  });

  return result.status === "ready"
    ? NextResponse.json({ changed: result.changed })
    : accessError(result.status);
}

export const GET = withApiErrorBoundary(readPlanChangedSince);
