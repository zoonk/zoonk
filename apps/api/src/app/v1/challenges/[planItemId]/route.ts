import { withApiErrorBoundary } from "@/lib/api-handler";
import { challengePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { getChallenge } from "@zoonk/core/checkpoints/challenge";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { NextResponse } from "next/server";

/** Returns a phase boss or the week's challenge by its plan item, before its day and on it. */
async function getChallengeRoute(
  request: Request,
  context: RouteContext<"/v1/challenges/[planItemId]">,
) {
  const path = await readPathParams(context, challengePathParamsSchema);

  const query = readQueryParams(request, studySessionTimeZoneInputSchema);

  const result = await getChallenge({ input: query, planItemId: path.planItemId });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(result.challenge);
}

export const GET = withApiErrorBoundary(getChallengeRoute);
