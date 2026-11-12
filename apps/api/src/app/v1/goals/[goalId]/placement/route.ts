import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError, noFocusTestError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams, readQueryParams } from "@/lib/request-input";
import { placementQuerySchema } from "@zoonk/core/learner/placement/contract";
import { updateFocusTest } from "@zoonk/core/learner/placement/controls";
import { focusTestControlsInputSchema } from "@zoonk/core/learner/placement/focus-test-contract";
import { getGoalPlacement } from "@zoonk/core/learner/placement/get";
import { type NextRequest, NextResponse } from "next/server";

type PlacementContext = RouteContext<"/v1/goals/[goalId]/placement">;

async function getPlacement(request: Request, context: PlacementContext) {
  const query = readQueryParams(request, placementQuerySchema);
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getGoalPlacement({ goalId: path.goalId, ...query });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(withApiImageUrls(result.placement));
}

async function updateControls(request: NextRequest, context: PlacementContext) {
  const [body, path] = await Promise.all([
    readBody(request, focusTestControlsInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await updateFocusTest({ goalId: path.goalId, input: body });

  if (result.status === "unavailable") {
    return noFocusTestError();
  }

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(result.focusTest);
}

export const GET = withApiErrorBoundary(getPlacement);
export const PATCH = withApiErrorBoundary(updateControls);
