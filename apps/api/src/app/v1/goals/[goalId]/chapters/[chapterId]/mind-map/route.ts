import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withApiImageUrls } from "@/lib/file-urls";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getChapterMindMap } from "@zoonk/core/mind-maps/get-chapter";
import { NextResponse } from "next/server";

/** Returns a chapter's mind map: ready, being made, or whether the learner can ask for it. */
async function getMindMap(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]/mind-map">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: goalChapterPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getChapterMindMap(path.data);

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(withApiImageUrls(result.mindMap));
}

export const GET = withApiErrorBoundary(getMindMap);
