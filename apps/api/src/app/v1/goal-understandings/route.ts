import { withApiErrorBoundary } from "@/lib/api-handler";
import { getUnderstandingLocation, startUnderstandingRun } from "@/lib/goal-understanding";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { readBody } from "@/lib/request-input";
import { isRefusedUsage } from "@zoonk/core/entitlements/contract";
import { goalUnderstandingInputSchema } from "@zoonk/core/view-models/onboarding/contract";
import { startGoalUnderstanding } from "@zoonk/core/view-models/onboarding/start-understanding";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;
const ACCEPTED = 202;

/**
 * Saves a goal the learner typed as a draft and starts reading it, for the "Here's what I
 * understood" card: at once when the same words were understood today, otherwise in a run.
 */
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

  return NextResponse.json(await startUnderstandingRun(result.draft), {
    headers,
    status: ACCEPTED,
  });
}

export const POST = withApiErrorBoundary(createGoalUnderstanding);
