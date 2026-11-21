import { withApiErrorBoundary } from "@/lib/api-handler";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams, readQueryParams } from "@/lib/request-input";
import { startLanguageLevelTestOutInputSchema } from "@zoonk/core/language/level-test/contract";
import {
  getLanguageLevelTestOut,
  startLanguageLevelTestOut,
} from "@zoonk/core/language/level-test/test-out";
import { levelTestOutFinishSchema } from "@zoonk/core/language/level-test/test-out-contract";
import { NextResponse } from "next/server";

type Context = RouteContext<"/v1/goals/[goalId]/language-level-test/test-outs">;

async function getTestOut(request: Request, context: Context) {
  const { goalId } = await readPathParams(context, goalPathParamsSchema);
  const { attemptId } = readQueryParams(request, levelTestOutFinishSchema);
  const result = await getLanguageLevelTestOut({ attemptId, goalId });

  return result.status === "ready"
    ? NextResponse.json(result.test, { headers: { "Cache-Control": "no-store" } })
    : levelTestError(result.status);
}

async function startTestOut(request: Request, context: Context) {
  const [{ goalId }, { level }] = await Promise.all([
    readPathParams(context, goalPathParamsSchema),
    readBody(request, startLanguageLevelTestOutInputSchema),
  ]);

  const result = await startLanguageLevelTestOut({ goalId, level });
  return result.status === "ready" ? NextResponse.json(result.test) : levelTestError(result.status);
}

export const GET = withApiErrorBoundary(getTestOut);
export const POST = withApiErrorBoundary(startTestOut);
