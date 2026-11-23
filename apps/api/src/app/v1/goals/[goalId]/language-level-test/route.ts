import { withApiErrorBoundary } from "@/lib/api-handler";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { finishLanguageLevelTestInputSchema } from "@zoonk/core/language/level-test/contract";
import { getLanguageLevelTest } from "@zoonk/core/language/level-test/get";
import { NextResponse } from "next/server";

async function getLevelTest(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const { attemptId } = readQueryParams(request, finishLanguageLevelTestInputSchema);
  const result = await getLanguageLevelTest(path.goalId, attemptId);

  if (result.status !== "ready") {
    return levelTestError(result.status);
  }

  return NextResponse.json(result.test, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withApiErrorBoundary(getLevelTest);
