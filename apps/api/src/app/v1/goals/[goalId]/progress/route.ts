import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getProgressView } from "@zoonk/core/view-models/progress/get";
import { NextResponse } from "next/server";

/** Returns the Progress tab's view model for one of the learner's goals. */
async function getProgress(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/progress">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getProgressView({ goalId: path.data.goalId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(result.progress);
}

export const GET = withApiErrorBoundary(getProgress);
