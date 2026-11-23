import { withApiErrorBoundary } from "@/lib/api-handler";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { finishLanguageLevelTestInputSchema } from "@zoonk/core/language/level-test/contract";
import { finishLanguageLevelTest } from "@zoonk/core/language/level-test/finish";
import { NextResponse } from "next/server";

async function finishLevelTest(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test/completions">,
) {
  const [path, { attemptId }] = await Promise.all([
    readPathParams(context, goalPathParamsSchema),
    readBody(request, finishLanguageLevelTestInputSchema, { emptyBody: {} }),
  ]);

  const result = await finishLanguageLevelTest(path.goalId, attemptId);

  if (result.status !== "ready") {
    return levelTestError(result.status);
  }

  return NextResponse.json({ levels: result.levels, result: result.result });
}

export const POST = withApiErrorBoundary(finishLevelTest);
