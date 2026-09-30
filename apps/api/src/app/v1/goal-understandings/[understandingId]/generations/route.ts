import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { isUnderstandingRunning, startUnderstandingRun } from "@/lib/goal-understanding";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalUnderstandingPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getOnboardingDraft } from "@zoonk/core/view-models/onboarding/get-draft";
import { prepareGoalUnderstandingRun } from "@zoonk/core/view-models/onboarding/prepare-understanding-run";
import { type NextRequest, NextResponse } from "next/server";

const ACCEPTED = 202;

/**
 * Starts reading a typed goal, or reads it again after its run failed or couldn't start. A run
 * still reading it is followed instead, and a goal already understood needs none.
 */
async function createGoalUnderstandingGeneration(
  _request: NextRequest,
  context: RouteContext<"/v1/goal-understandings/[understandingId]/generations">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: goalUnderstandingPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const draftId = path.data.understandingId;
  const current = await getOnboardingDraft({ draftId });

  if (current.status !== "ready") {
    return accessError(current.status);
  }

  if (await isUnderstandingRunning(current.draft)) {
    return NextResponse.json(current.draft, { status: ACCEPTED });
  }

  const prepared = await prepareGoalUnderstandingRun({ draftId });

  if (prepared.status === "slowDown" || prepared.status === "limitReached") {
    return usageDecisionError(prepared);
  }

  if (prepared.status === "understood") {
    return NextResponse.json(prepared.draft);
  }

  if (prepared.status !== "start") {
    return accessError(prepared.status);
  }

  return NextResponse.json(await startUnderstandingRun(prepared.draft), { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(createGoalUnderstandingGeneration);
