import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getFieldMapView } from "@zoonk/core/view-models/map/get";
import { NextResponse } from "next/server";

async function getMap(_request: Request, context: RouteContext<"/v1/goals/[goalId]/map">) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getFieldMapView({ goalId: path.goalId });

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(result.map);
}

export const GET = withApiErrorBoundary(getMap);
