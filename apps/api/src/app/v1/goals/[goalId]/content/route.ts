import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getContentView } from "@zoonk/core/view-models/content/get";
import { NextResponse } from "next/server";

/** Returns the Content tab's view model for one of the learner's goals. */
async function getContent(_request: Request, context: RouteContext<"/v1/goals/[goalId]/content">) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getContentView({ goalId: path.goalId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(result.content);
}

export const GET = withApiErrorBoundary(getContent);
