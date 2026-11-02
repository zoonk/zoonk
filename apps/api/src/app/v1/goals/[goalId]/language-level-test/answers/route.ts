import { withApiErrorBoundary } from "@/lib/api-handler";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { answerLanguageLevelTest } from "@zoonk/core/language/level-test/answer";
import { levelTestAnswerInputSchema } from "@zoonk/core/language/level-test/contract";
import { type NextRequest, NextResponse } from "next/server";

async function answerLevelTest(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test/answers">,
) {
  const [body, path] = await Promise.all([
    readBody(request, levelTestAnswerInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await answerLanguageLevelTest({ goalId: path.goalId, input: body });

  if (result.status !== "ready") {
    return levelTestError(result.status);
  }

  return NextResponse.json(result.test);
}

export const POST = withApiErrorBoundary(answerLevelTest);
