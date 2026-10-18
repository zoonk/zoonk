import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getChapterView } from "@zoonk/core/view-models/chapter/get";
import { NextResponse } from "next/server";

/** Returns a chapter of the learner's plan: its map, lessons, mistakes and summaries. */
async function getChapter(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: goalChapterPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getChapterView(path.data);

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(result.chapter);
}

export const GET = withApiErrorBoundary(getChapter);
