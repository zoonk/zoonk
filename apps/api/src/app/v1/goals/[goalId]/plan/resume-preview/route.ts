import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getGoalResumePreview } from "@zoonk/core/plans/resume-preview";
import { NextResponse } from "next/server";

async function readResumePreview(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/plan/resume-preview">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await getGoalResumePreview(path.goalId);

  return result.status === "ready" ? NextResponse.json(result.preview) : accessError(result.status);
}

export const GET = withApiErrorBoundary(readResumePreview);
