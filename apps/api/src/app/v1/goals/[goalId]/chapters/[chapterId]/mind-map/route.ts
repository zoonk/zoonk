import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getChapterMindMap } from "@zoonk/core/mind-maps/get-chapter";
import { NextResponse } from "next/server";

async function getMindMap(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]/mind-map">,
) {
  const path = await readPathParams(context, goalChapterPathParamsSchema);

  const result = await getChapterMindMap(path);

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(withApiImageUrls(result.mindMap));
}

export const GET = withApiErrorBoundary(getMindMap);
