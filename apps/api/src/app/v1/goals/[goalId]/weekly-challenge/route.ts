import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeWeeklyChallenge } from "@/lib/study-session-serializers";
import { getWeeklyChallenge } from "@zoonk/core/checkpoints/weekly-challenge";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { NextResponse } from "next/server";

async function getChallenge(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/weekly-challenge">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const query = readQueryParams(request, studySessionTimeZoneInputSchema);

  const result = await getWeeklyChallenge({ goalId: path.goalId, timeZone: query.timeZone });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(serializeWeeklyChallenge(result.challenge));
}

export const GET = withApiErrorBoundary(getChallenge);
