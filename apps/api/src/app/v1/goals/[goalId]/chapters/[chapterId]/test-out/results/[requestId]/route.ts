import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalChapterTestOutResultPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getRecordedTestOut } from "@zoonk/core/learner/test-out/recorded";
import { NextResponse } from "next/server";

type TestOutResultContext =
  RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]/test-out/results/[requestId]">;

async function getTestOutResult(_request: Request, context: TestOutResultContext) {
  const path = await readPathParams(context, goalChapterTestOutResultPathParamsSchema);

  const result = await getRecordedTestOut(path);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(result.result);
}

export const GET = withApiErrorBoundary(getTestOutResult);
