import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getProgressView } from "@zoonk/core/view-models/progress/get";
import { NextResponse } from "next/server";

/** Returns the Progress tab's view model for one of the learner's goals. */
async function getProgress(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/progress">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getProgressView({ goalId: path.goalId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(result.progress);
}

export const GET = withApiErrorBoundary(getProgress);
