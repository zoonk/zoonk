import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startLevelTestBank } from "@/lib/level-test-bank";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getRequestPlatform } from "@zoonk/core/analytics/request-platform";
import { prepareLanguageLevelTest } from "@zoonk/core/language/level-test/prepare";
import { NextResponse } from "next/server";

const ACCEPTED = 202;

/**
 * Starts writing the language pair's level test questions when nothing is writing them yet, such
 * as when the run started with the goal failed: the learner's own tap asks, never showing the test.
 * A run already writing them is joined, and written questions start nothing.
 */
async function createLevelTestGeneration(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test/generations">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const [preparation, platform] = await Promise.all([
    prepareLanguageLevelTest(path.data.goalId),
    getRequestPlatform(),
  ]);

  if (preparation.status === "ready") {
    return NextResponse.json({ generationId: null, status: "ready" });
  }

  if (preparation.status !== "preparing") {
    return levelTestError(preparation.status);
  }

  const { generationId } = await startLevelTestBank({
    analytics: { distinctId: preparation.learnerId, goalId: path.data.goalId, platform },
    pair: preparation.pair,
  });

  return NextResponse.json(
    { generationId, status: "started" },
    {
      headers: { Location: `/v1/generations/${encodeURIComponent(generationId)}` },
      status: ACCEPTED,
    },
  );
}

export const POST = withApiErrorBoundary(createLevelTestGeneration);
