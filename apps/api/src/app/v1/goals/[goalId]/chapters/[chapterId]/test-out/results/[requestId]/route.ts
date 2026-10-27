import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { learnerAccessError } from "@/lib/learner-errors";
import { goalChapterTestOutResultPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getRecordedTestOut } from "@zoonk/core/learner/test-out/recorded";
import { NextResponse } from "next/server";

type TestOutResultContext =
  RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]/test-out/results/[requestId]">;

/** Returns a sent test-out's result as it was recorded. */
async function getTestOutResult(_request: Request, context: TestOutResultContext) {
  const path = parsePathParams({
    params: await context.params,
    schema: goalChapterTestOutResultPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getRecordedTestOut(path.data);

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  return NextResponse.json(result.result);
}

export const GET = withApiErrorBoundary(getTestOutResult);
