import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import {
  getUnderstandingLocation,
  runSavedDraft,
  startUnderstandingRun,
} from "@/lib/goal-understanding";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { readBody } from "@/lib/request-input";
import { isRefusedUsage } from "@zoonk/core/entitlements/contract";
import {
  type OnboardingDraftView,
  goalUnderstandingInputSchema,
} from "@zoonk/core/view-models/onboarding/contract";
import { startGoalUnderstanding } from "@zoonk/core/view-models/onboarding/start-understanding";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;
const ACCEPTED = 202;

/** A draft no run has recorded was paid for by its start; one whose run already ran is read again as a retry. */
async function runDraft(draft: OnboardingDraftView) {
  if (draft.generationId === null) {
    return { draft: await startUnderstandingRun(draft), status: "reading" as const };
  }

  return runSavedDraft(draft);
}

async function createGoalUnderstanding(request: NextRequest) {
  const parsed = await readBody(request, goalUnderstandingInputSchema);

  const result = await startGoalUnderstanding(parsed);

  if (result.status === "unauthorized" || isRefusedUsage(result)) {
    return usageDecisionError(result);
  }

  const headers = { Location: getUnderstandingLocation(result.draft.id) };

  if (result.status === "understood") {
    return NextResponse.json(result.draft, { headers, status: CREATED });
  }

  const run = await runDraft(result.draft);

  if (isRefusedUsage(run)) {
    return usageDecisionError(run);
  }

  if (run.status === "reading") {
    return NextResponse.json(run.draft, { headers, status: ACCEPTED });
  }

  if (run.status === "understood") {
    return NextResponse.json(run.draft, { headers, status: CREATED });
  }

  return accessError(run.status);
}

export const POST = withApiErrorBoundary(createGoalUnderstanding);
