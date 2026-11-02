import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { isUnderstandingRunning, startUnderstandingRun } from "@/lib/goal-understanding";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalUnderstandingPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { isRefusedUsage } from "@zoonk/core/entitlements/contract";
import { getOnboardingDraft } from "@zoonk/core/view-models/onboarding/get-draft";
import { prepareGoalUnderstandingRun } from "@zoonk/core/view-models/onboarding/prepare-understanding-run";
import { type NextRequest, NextResponse } from "next/server";

const ACCEPTED = 202;

async function createGoalUnderstandingGeneration(
  _request: NextRequest,
  context: RouteContext<"/v1/goal-understandings/[understandingId]/generations">,
) {
  const path = await readPathParams(context, goalUnderstandingPathParamsSchema);

  const draftId = path.understandingId;
  const current = await getOnboardingDraft({ draftId });

  if (current.status !== "ready") {
    return accessError(current.status);
  }

  if (await isUnderstandingRunning(current.draft)) {
    return NextResponse.json(current.draft, { status: ACCEPTED });
  }

  const prepared = await prepareGoalUnderstandingRun({ draftId });

  if (isRefusedUsage(prepared)) {
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
