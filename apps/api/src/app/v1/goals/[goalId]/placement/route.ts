import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { placementQuerySchema } from "@zoonk/core/learner/placement/contract";
import { getGoalPlacement } from "@zoonk/core/learner/placement/get";
import { NextResponse } from "next/server";

/** Returns each phase's starting point and the next placement question. */
async function getPlacement(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/placement">,
) {
  const query = parseQueryParams(new URL(request.url).searchParams, placementQuerySchema);
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getGoalPlacement({ goalId: path.data.goalId, ...query.data });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(withApiImageUrls(result.placement));
}

export const GET = withApiErrorBoundary(getPlacement);
