import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getExplanation } from "@zoonk/core/view-models/explain/get";
import { NextResponse } from "next/server";

async function getGoalExplanation(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/explanation">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getExplanation({ goalId: path.goalId });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return result.status === "ready"
    ? NextResponse.json(withApiImageUrls(result.explanation))
    : errors.notFound();
}

export const GET = withApiErrorBoundary(getGoalExplanation);
