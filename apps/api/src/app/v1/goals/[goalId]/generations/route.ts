import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startGoalGeneration } from "@/lib/goal-content";
import { learnerAccessError } from "@/lib/learner-errors";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalGenerationQuerySchema } from "@/lib/openapi/schemas/content-generation";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
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
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getGoalGenerationId({ goalId: path.data.goalId });

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
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });
  const query = parseQueryParams(request.nextUrl.searchParams, goalGenerationQuerySchema);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!query.success) {
    return errors.validation(query.error);
  }

  const access = await getGoalGenerationAccess({
    goalId: path.data.goalId,
    withResearch: Boolean(query.data.researchId),
  });

  if (isRefusedUsage(access)) {
    return usageDecisionError(access);
  }

  if (access.status !== "ready") {
    return learnerAccessError(access.status);
  }

  const generation = await startGoalGeneration({
    goal: access.goal,
    researchId: query.data.researchId ?? null,
  });

  return NextResponse.json(generation, {
    headers: { Location: `/v1/generations/${encodeURIComponent(generation.generationId)}` },
    status: ACCEPTED,
  });
}

export const GET = withApiErrorBoundary(readGoalGeneration);
export const POST = withApiErrorBoundary(createGoalGeneration);
