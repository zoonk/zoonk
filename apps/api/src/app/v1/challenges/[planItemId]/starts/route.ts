import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { challengePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { studySessionError } from "@/lib/study-session-errors";
import { startChallenge } from "@zoonk/core/checkpoints/challenge-start";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

/** Starts a challenge on its day and says where it's played. */
async function startChallengeRoute(
  request: NextRequest,
  context: RouteContext<"/v1/challenges/[planItemId]/starts">,
) {
  const path = parsePathParams({ params: await context.params, schema: challengePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, studySessionTimeZoneInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await startChallenge({ input: body.data, planItemId: path.data.planItemId });

  if (result.status === "ready") {
    return NextResponse.json(result.destination);
  }

  return result.status === "notToday"
    ? errors.conflict("It isn't in today's session")
    : studySessionError({ status: result.status });
}

export const POST = withApiErrorBoundary(startChallengeRoute);
