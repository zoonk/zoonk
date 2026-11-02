import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { placementQuerySchema } from "@zoonk/core/learner/placement/contract";
import { getGoalPlacement } from "@zoonk/core/learner/placement/get";
import { NextResponse } from "next/server";

async function getPlacement(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/placement">,
) {
  const query = readQueryParams(request, placementQuerySchema);
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getGoalPlacement({ goalId: path.goalId, ...query });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(withApiImageUrls(result.placement));
}

export const GET = withApiErrorBoundary(getPlacement);
