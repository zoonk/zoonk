import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { requestGoalMindMaps } from "@zoonk/core/mind-maps/request-all";
import { NextResponse } from "next/server";

const ACCEPTED = 202;

async function createGoalMindMapGenerations(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/mind-maps/generations">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await requestGoalMindMaps(path);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(result.generations, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(createGoalMindMapGenerations);
