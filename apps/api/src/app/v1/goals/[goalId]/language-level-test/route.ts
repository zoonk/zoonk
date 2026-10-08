import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
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
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getLanguageLevelTest(path.data.goalId);

  if (result.status !== "ready") {
    return levelTestError(result.status);
  }

  return NextResponse.json(result.test, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withApiErrorBoundary(getLevelTest);
