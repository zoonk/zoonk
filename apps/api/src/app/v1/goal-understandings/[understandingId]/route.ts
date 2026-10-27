import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalUnderstandingPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { onboardingDraftEditSchema } from "@zoonk/core/view-models/onboarding/contract";
import { getOnboardingDraft } from "@zoonk/core/view-models/onboarding/get-draft";
import { reviseOnboardingDraft } from "@zoonk/core/view-models/onboarding/revise-draft";
import { type NextRequest, NextResponse } from "next/server";

type Context = RouteContext<"/v1/goal-understandings/[understandingId]">;

/** A typed goal as it stands: being read (with its run), understood with the learner's fixes, or failed. */
async function getGoalUnderstanding(_request: NextRequest, context: Context) {
  const path = await readPathParams(context, goalUnderstandingPathParamsSchema);

  const result = await getOnboardingDraft({ draftId: path.understandingId });

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  return NextResponse.json(result.draft);
}

/** One fix on the "Here's what I understood" card; the fields that depend on it follow. */
async function reviseGoalUnderstanding(request: NextRequest, context: Context) {
  const [path, body] = await Promise.all([
    readPathParams(context, goalUnderstandingPathParamsSchema),
    readBody(request, onboardingDraftEditSchema),
  ]);

  const result = await reviseOnboardingDraft({ draftId: path.understandingId, edit: body });

  if (result.status === "conflict") {
    return errors.conflict("This goal can't be changed now");
  }

  if (result.status === "invalid") {
    return errors.unprocessableEntity("This change doesn't apply to that goal");
  }

  if (result.status !== "revised") {
    return accessError(result.status);
  }

  return NextResponse.json(result.draft);
}

export const GET = withApiErrorBoundary(getGoalUnderstanding);
export const PATCH = withApiErrorBoundary(reviseGoalUnderstanding);
