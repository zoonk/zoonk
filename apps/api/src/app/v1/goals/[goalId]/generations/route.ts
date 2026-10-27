import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startGoalGeneration } from "@/lib/goal-content";
import { learnerAccessError } from "@/lib/learner-errors";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalGenerationQuerySchema } from "@/lib/openapi/schemas/content-generation";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { isRefusedUsage } from "@zoonk/core/entitlements/contract";
import { getGoalGenerationId } from "@zoonk/core/goals/generation-id";
import { getGoalGenerationAccess } from "@zoonk/core/lookahead/goal-generation-access";
import { type NextRequest, NextResponse } from "next/server";

const ACCEPTED = 202;

/**
 * The run writing the goal's curriculum (or its explanation), for a wait that opened before the
 * goal had one: it asks every few seconds, so it reads the one column, and never starts a run.
 */
async function readGoalGeneration(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/generations">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);
  const result = await getGoalGenerationId({ goalId: path.goalId });

  return result.status === "ready"
    ? NextResponse.json({ generationId: result.generationId })
    : accessError(result.status);
}

/**
 * Starts a goal's curriculum (or its explanation) again, such as after a start failed or a run
 * gave up. The run only writes what is still missing, and a run already going is joined.
 */
async function createGoalGeneration(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/generations">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);
  const query = readQueryParams(request, goalGenerationQuerySchema);

  const access = await getGoalGenerationAccess({
    goalId: path.goalId,
    withResearch: Boolean(query.researchId),
  });

  if (isRefusedUsage(access)) {
    return usageDecisionError(access);
  }

  if (access.status !== "ready") {
    return learnerAccessError(access.status);
  }

  const generation = await startGoalGeneration({
    goal: access.goal,
    researchId: query.researchId ?? null,
  });

  return NextResponse.json(generation, {
    headers: { Location: `/v1/generations/${encodeURIComponent(generation.generationId)}` },
    status: ACCEPTED,
  });
}

export const GET = withApiErrorBoundary(readGoalGeneration);
export const POST = withApiErrorBoundary(createGoalGeneration);
