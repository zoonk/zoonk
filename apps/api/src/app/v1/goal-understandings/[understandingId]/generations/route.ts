import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { runSavedDraft } from "@/lib/goal-understanding";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalUnderstandingPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { isRefusedUsage } from "@zoonk/core/entitlements/contract";
import { getOnboardingDraft } from "@zoonk/core/view-models/onboarding/get-draft";
import { type NextRequest, NextResponse } from "next/server";

const ACCEPTED = 202;

async function createGoalUnderstandingGeneration(
  _request: NextRequest,
  context: RouteContext<"/v1/goal-understandings/[understandingId]/generations">,
) {
  const path = await readPathParams(context, goalUnderstandingPathParamsSchema);
  const current = await getOnboardingDraft({ draftId: path.understandingId });

  if (current.status !== "ready") {
    return accessError(current.status);
  }

  const run = await runSavedDraft(current.draft);

  if (isRefusedUsage(run)) {
    return usageDecisionError(run);
  }

  if (run.status === "reading") {
    return NextResponse.json(run.draft, { status: ACCEPTED });
  }

  if (run.status === "understood") {
    return NextResponse.json(run.draft);
  }

  return accessError(run.status);
}

export const POST = withApiErrorBoundary(createGoalUnderstandingGeneration);
