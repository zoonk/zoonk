import { withApiErrorBoundary } from "@/lib/api-handler";
import { startLevelTestBank } from "@/lib/level-test-bank";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getRequestPlatform } from "@zoonk/core/analytics/request-platform";
import { prepareLanguageLevelTest } from "@zoonk/core/language/level-test/prepare";
import { NextResponse } from "next/server";

const ACCEPTED = 202;

async function createLevelTestGeneration(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test/generations">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const [preparation, platform] = await Promise.all([
    prepareLanguageLevelTest(path.goalId),
    getRequestPlatform(),
  ]);

  if (preparation.status === "ready") {
    return NextResponse.json({ generationId: null, status: "ready" });
  }

  if (preparation.status !== "preparing") {
    return levelTestError(preparation.status);
  }

  const { generationId } = await startLevelTestBank({
    analytics: { distinctId: preparation.learnerId, goalId: path.goalId, platform },
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
