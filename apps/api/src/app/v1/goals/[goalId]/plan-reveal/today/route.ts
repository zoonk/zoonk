import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { serializeStudySession } from "@/lib/study-session-serializers";
import { todayUnavailableError } from "@/lib/today-errors";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { getPlanRevealToday } from "@zoonk/core/view-models/today/plan-reveal";
import { NextResponse } from "next/server";

async function getRevealToday(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/plan-reveal/today">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);
  const query = readQueryParams(request, studySessionTimeZoneInputSchema);

  const result = await getPlanRevealToday(path.goalId, query.timeZone);

  if (result.status !== "ready") {
    return todayUnavailableError(result);
  }

  return NextResponse.json(serializeStudySession(result.session));
}

export const GET = withApiErrorBoundary(getRevealToday);
