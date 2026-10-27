import { withApiErrorBoundary } from "@/lib/api-handler";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getLanguageLevelTest } from "@zoonk/core/language/level-test/get";
import { NextResponse } from "next/server";

/**
 * The language goal's three-minute level test: the next question near the learner's level, then
 * one sentence out loud, and the levels so far. `preparing`, with since when and how long it usually
 * takes, while the pair's questions are written. Read-only: a workflow writes them.
 */
async function getLevelTest(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getLanguageLevelTest(path.goalId);

  if (result.status !== "ready") {
    return levelTestError(result.status);
  }

  return NextResponse.json(result.test, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withApiErrorBoundary(getLevelTest);
