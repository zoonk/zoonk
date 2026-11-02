import { withApiErrorBoundary } from "@/lib/api-handler";
import { milestonePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { markMilestoneShown } from "@zoonk/core/milestones/list";
import { serializeMilestone } from "@zoonk/core/sessions/completion-contract";
import { NextResponse } from "next/server";

async function createView(
  _request: Request,
  context: RouteContext<"/v1/me/milestones/[milestoneId]/views">,
) {
  const path = await readPathParams(context, milestonePathParamsSchema);

  const result = await markMilestoneShown(path.milestoneId);

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(serializeMilestone(result.milestone));
}

export const POST = withApiErrorBoundary(createView);
