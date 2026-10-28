import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getChapterView } from "@zoonk/core/view-models/chapter/get";
import { NextResponse } from "next/server";

async function getChapter(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]">,
) {
  const path = await readPathParams(context, goalChapterPathParamsSchema);

  const result = await getChapterView(path);

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(result.chapter);
}

export const GET = withApiErrorBoundary(getChapter);
