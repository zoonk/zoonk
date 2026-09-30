import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getContentView } from "@zoonk/core/view-models/content/get";
import { NextResponse } from "next/server";

/** Returns the Content tab's view model (Cards in Fun) for one of the learner's goals. */
async function getContent(_request: Request, context: RouteContext<"/v1/goals/[goalId]/content">) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getContentView({ goalId: path.data.goalId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(result.content);
}

export const GET = withApiErrorBoundary(getContent);
