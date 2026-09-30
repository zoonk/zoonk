import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { reviewFlagPathParamsSchema } from "@/lib/openapi/schemas/review-flags";
import { parsePathParams } from "@/lib/path-params";
import { flaggedContentWorkflow } from "@/workflows/v2/review-flags/flagged-content-workflow";
import { getOpenReviewFlagForAdmin } from "@zoonk/core/library/review-flags/admin";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

const ACCEPTED = 202;

/**
 * An admin's "Rewrite now" on one flag in the review queue: the flagged lesson or law drills are
 * written again from the source as it is now, like the daily sweep does for every open flag.
 */
async function createReviewFlagRewrite(
  _request: Request,
  context: RouteContext<"/v1/library/review-flags/[flagId]/rewrites">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: reviewFlagPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getOpenReviewFlagForAdmin(path.data.flagId);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "forbidden") {
    return errors.forbidden();
  }

  if (result.status === "notFound") {
    return errors.notFound("Open review flag not found");
  }

  const run = await start(flaggedContentWorkflow, [{ flagIds: [result.flagId] }]);

  return NextResponse.json({ runId: run.runId }, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(createReviewFlagRewrite);
