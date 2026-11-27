import { withApiErrorBoundary } from "@/lib/api-handler";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { startLanguageLevelTestInputSchema } from "@zoonk/core/language/level-test/contract";
import { startLanguageLevelTest } from "@zoonk/core/language/level-test/start";
import { NextResponse } from "next/server";

async function startLevelTest(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test/attempts">,
) {
  const [{ goalId }] = await Promise.all([
    readPathParams(context, goalPathParamsSchema),
    readBody(request, startLanguageLevelTestInputSchema),
  ]);

  const result = await startLanguageLevelTest({ goalId });

  return result.status === "ready" ? NextResponse.json(result.test) : levelTestError(result.status);
}

export const POST = withApiErrorBoundary(startLevelTest);
