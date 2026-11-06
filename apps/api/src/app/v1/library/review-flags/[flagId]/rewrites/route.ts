import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { reviewFlagPathParamsSchema } from "@/lib/openapi/schemas/review-flags";
import { readPathParams } from "@/lib/request-input";
import { startOnce } from "@/workflows/_shared/run-token";
import { flaggedContentWorkflow } from "@/workflows/review-flags/flagged-content-workflow";
import { getOpenReviewFlagForAdmin } from "@zoonk/core/library/review-flags/admin";
import { NextResponse } from "next/server";

const ACCEPTED = 202;

async function createReviewFlagRewrite(
  _request: Request,
  context: RouteContext<"/v1/library/review-flags/[flagId]/rewrites">,
) {
  const path = await readPathParams(context, reviewFlagPathParamsSchema);

  const result = await getOpenReviewFlagForAdmin(path.flagId);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "forbidden") {
    return errors.forbidden();
  }

  if (result.status === "notFound") {
    return errors.notFound("Open review flag not found");
  }

  const runId = await startOnce(
    flaggedContentWorkflow,
    [{ flagIds: [result.flagId] }],
    `review-flag-rewrite:${result.flagId}`,
  );

  return NextResponse.json({ runId }, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(createReviewFlagRewrite);
