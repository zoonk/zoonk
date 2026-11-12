import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { listChapterLessonMaps } from "@zoonk/core/mind-maps/lesson-maps";
import { NextResponse } from "next/server";

async function getLessonMaps(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]/lesson-maps">,
) {
  const path = await readPathParams(context, goalChapterPathParamsSchema);

  const result = await listChapterLessonMaps(path);

  if (result.status !== "ready") {
    return learnerAccessError(result.status === "unauthorized" ? "unauthorized" : "notFound");
  }

  return NextResponse.json(result.lessonMaps);
}

export const GET = withApiErrorBoundary(getLessonMaps);
