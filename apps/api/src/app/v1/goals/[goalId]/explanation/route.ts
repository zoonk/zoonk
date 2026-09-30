import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getExplanation } from "@zoonk/core/view-models/explain/get";
import { NextResponse } from "next/server";

/** A quick explanation: its story and check, or `preparing` while it's being written. */
async function getGoalExplanation(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/explanation">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getExplanation({ goalId: path.data.goalId });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return result.status === "ready" ? NextResponse.json(result.explanation) : errors.notFound();
}

export const GET = withApiErrorBoundary(getGoalExplanation);
