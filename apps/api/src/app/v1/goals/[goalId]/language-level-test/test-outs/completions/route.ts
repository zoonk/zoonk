import { withApiErrorBoundary } from "@/lib/api-handler";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { levelTestOutFinishSchema } from "@zoonk/core/language/level-test/test-out-contract";
import { finishLanguageLevelTestOut } from "@zoonk/core/language/level-test/test-out-finish";
import { NextResponse } from "next/server";

async function finishTestOut(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test/test-outs/completions">,
) {
  const [{ goalId }, { attemptId }] = await Promise.all([
    readPathParams(context, goalPathParamsSchema),
    readBody(request, levelTestOutFinishSchema),
  ]);

  const result = await finishLanguageLevelTestOut({ attemptId, goalId });
  return result.status === "ready" ? NextResponse.json(result.test) : levelTestError(result.status);
}

export const POST = withApiErrorBoundary(finishTestOut);
