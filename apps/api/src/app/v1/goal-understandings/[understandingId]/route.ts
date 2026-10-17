import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { goalUnderstandingPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { onboardingDraftEditSchema } from "@zoonk/core/view-models/onboarding/contract";
import { getOnboardingDraft } from "@zoonk/core/view-models/onboarding/get-draft";
import { reviseOnboardingDraft } from "@zoonk/core/view-models/onboarding/revise-draft";
import { type NextRequest, NextResponse } from "next/server";

type Context = RouteContext<"/v1/goal-understandings/[understandingId]">;

/** A typed goal as it stands: being read (with its run), understood with the learner's fixes, or failed. */
async function getGoalUnderstanding(_request: NextRequest, context: Context) {
  const path = parsePathParams({
    params: await context.params,
    schema: goalUnderstandingPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getOnboardingDraft({ draftId: path.data.understandingId });

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  return NextResponse.json(result.draft);
}

/** One fix on the "Here's what I understood" card; the fields that depend on it follow. */
async function reviseGoalUnderstanding(request: NextRequest, context: Context) {
  const [path, body] = await Promise.all([
    context.params.then((params) =>
      parsePathParams({ params, schema: goalUnderstandingPathParamsSchema }),
    ),
    parseBody(request, onboardingDraftEditSchema),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await reviseOnboardingDraft({
    draftId: path.data.understandingId,
    edit: body.data,
  });

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
