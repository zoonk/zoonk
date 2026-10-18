import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getFieldMapView } from "@zoonk/core/view-models/map/get";
import { NextResponse } from "next/server";

/** Returns the map of the field for one of the learner's goals. */
async function getMap(_request: Request, context: RouteContext<"/v1/goals/[goalId]/map">) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getFieldMapView({ goalId: path.data.goalId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(result.map);
}

export const GET = withApiErrorBoundary(getMap);
