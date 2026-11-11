import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError, noFocusTestError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { placementSittingInputSchema } from "@zoonk/core/learner/placement/focus-test-contract";
import { startPlacementSitting } from "@zoonk/core/learner/placement/sitting";
import { type NextRequest, NextResponse } from "next/server";

async function createPlacementSitting(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/placement/sittings">,
) {
  const [body, path] = await Promise.all([
    readBody(request, placementSittingInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await startPlacementSitting({ goalId: path.goalId, input: body });

  if (result.status === "unavailable") {
    return noFocusTestError();
  }

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(withApiImageUrls(result.placement));
}

export const POST = withApiErrorBoundary(createPlacementSitting);
