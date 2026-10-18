import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeWeeklyChallenge } from "@/lib/study-session-serializers";
import { getWeeklyChallenge } from "@zoonk/core/checkpoints/weekly-challenge";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { NextResponse } from "next/server";

/** Returns the goal's next weekly checkpoint (the Big Challenge), or null when none is planned. */
async function getChallenge(
  request: Request,
  context: RouteContext<"/v1/goals/[goalId]/weekly-challenge">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

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

  const result = await getWeeklyChallenge({
    goalId: path.data.goalId,
    timeZone: query.data.timeZone,
  });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(serializeWeeklyChallenge(result.challenge));
}

export const GET = withApiErrorBoundary(getChallenge);
