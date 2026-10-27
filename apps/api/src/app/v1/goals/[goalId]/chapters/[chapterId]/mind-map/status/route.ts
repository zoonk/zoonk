import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getChapterMindMapStatus } from "@zoonk/core/mind-maps/status";
import { NextResponse } from "next/server";

/** A live status read for a chapter map's wait, without loading its full view. */
async function getStatus(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]/mind-map/status">,
) {
  const path = await readPathParams(context, goalChapterPathParamsSchema);

  const result = await getChapterMindMapStatus(path);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(result.mindMap, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withApiErrorBoundary(getStatus);
