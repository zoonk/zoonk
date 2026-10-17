import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planChangedSinceQuerySchema } from "@/lib/openapi/schemas/plan-changed-since";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { getPlanChangedSince } from "@zoonk/core/plans/changed-since";
import { NextResponse } from "next/server";

/** Whether the plan, or Today, changed since the client read it. */
async function readPlanChangedSince(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/plan/changed-since">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  const query = parseQueryParams(new URL(request.url).searchParams, planChangedSinceQuerySchema);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getPlanChangedSince({
    goalId: path.data.goalId,
    since: Date.parse(query.data.since),
    watch: query.data.watch,
  });

  return result.status === "ready"
    ? NextResponse.json({ changed: result.changed })
    : accessError(result.status);
}

export const GET = withApiErrorBoundary(readPlanChangedSince);
