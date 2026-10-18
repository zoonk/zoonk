import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { milestonePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { studySessionError } from "@/lib/study-session-errors";
import { markMilestoneShown } from "@zoonk/core/milestones/list";
import { NextResponse } from "next/server";

/** Records that a milestone was celebrated, so it's shown only once. */
async function createView(
  _request: Request,
  context: RouteContext<"/v1/me/milestones/[milestoneId]/views">,
) {
  const path = parsePathParams({ params: await context.params, schema: milestonePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await markMilestoneShown(path.data.milestoneId);

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(result.milestone);
}

export const POST = withApiErrorBoundary(createView);
