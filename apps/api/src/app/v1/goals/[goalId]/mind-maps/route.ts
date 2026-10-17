import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { listGoalMindMaps } from "@zoonk/core/mind-maps/list";
import { NextResponse } from "next/server";

/** Returns a goal's mind maps: every chapter the learner finished, with its map or the way to make it. */
async function getGoalMindMaps(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/mind-maps">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await listGoalMindMaps(path.data);

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(withApiImageUrls(result.mindMaps));
}

export const GET = withApiErrorBoundary(getGoalMindMaps);
