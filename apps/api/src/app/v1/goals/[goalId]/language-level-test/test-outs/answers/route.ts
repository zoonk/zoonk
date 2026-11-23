import { withApiErrorBoundary } from "@/lib/api-handler";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { answerLanguageLevelTestOut } from "@zoonk/core/language/level-test/test-out";
import { levelTestOutAnswerSchema } from "@zoonk/core/language/level-test/test-out-contract";
import { NextResponse } from "next/server";

async function answerTestOut(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test/test-outs/answers">,
) {
  const [{ goalId }, input] = await Promise.all([
    readPathParams(context, goalPathParamsSchema),
    readBody(request, levelTestOutAnswerSchema),
  ]);

  const result = await answerLanguageLevelTestOut({ goalId, input });
  return result.status === "ready" ? NextResponse.json(result.test) : levelTestError(result.status);
}

export const POST = withApiErrorBoundary(answerTestOut);
