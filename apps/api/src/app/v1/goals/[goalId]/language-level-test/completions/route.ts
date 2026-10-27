import { withApiErrorBoundary } from "@/lib/api-handler";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { finishLanguageLevelTest } from "@zoonk/core/language/level-test/finish";
import { NextResponse } from "next/server";

/**
 * Ends the level test whenever the learner wants: the answers so far set a level for each skill,
 * which the plan and every call use from then on.
 */
async function finishLevelTest(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test/completions">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await finishLanguageLevelTest(path.goalId);

  if (result.status !== "ready") {
    return levelTestError(result.status);
  }

  return NextResponse.json({ levels: result.levels });
}

export const POST = withApiErrorBoundary(finishLevelTest);
