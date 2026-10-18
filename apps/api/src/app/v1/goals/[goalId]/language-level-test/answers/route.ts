import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { answerLanguageLevelTest } from "@zoonk/core/language/level-test/answer";
import { levelTestAnswerInputSchema } from "@zoonk/core/language/level-test/contract";
import { type NextRequest, NextResponse } from "next/server";

/** Records one level test answer ("I don't know" included) and returns what comes next. */
async function answerLevelTest(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test/answers">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, levelTestAnswerInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await answerLanguageLevelTest({ goalId: path.data.goalId, input: body.data });

  if (result.status !== "ready") {
    return levelTestError(result.status);
  }

  return NextResponse.json(result.test);
}

export const POST = withApiErrorBoundary(answerLevelTest);
