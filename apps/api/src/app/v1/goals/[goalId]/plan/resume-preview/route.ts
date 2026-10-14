import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getGoalResumePreview } from "@zoonk/core/plans/resume-preview";
import { NextResponse } from "next/server";

/** What resuming a paused goal would do to its plan, before the learner resumes it. */
async function readResumePreview(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/plan/resume-preview">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getGoalResumePreview(path.data.goalId);

  return result.status === "ready" ? NextResponse.json(result.preview) : accessError(result.status);
}

export const GET = withApiErrorBoundary(readResumePreview);
