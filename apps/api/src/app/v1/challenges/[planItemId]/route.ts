import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { challengePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { studySessionError } from "@/lib/study-session-errors";
import { getChallenge } from "@zoonk/core/checkpoints/challenge";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { NextResponse } from "next/server";

/** Returns a phase boss or the week's challenge by its plan item, before its day and on it. */
async function getChallengeRoute(
  request: Request,
  context: RouteContext<"/v1/challenges/[planItemId]">,
) {
  const path = parsePathParams({ params: await context.params, schema: challengePathParamsSchema });

  const query = parseQueryParams(
    new URL(request.url).searchParams,
    studySessionTimeZoneInputSchema,
  );

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getChallenge({ input: query.data, planItemId: path.data.planItemId });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(result.challenge);
}

export const GET = withApiErrorBoundary(getChallengeRoute);
