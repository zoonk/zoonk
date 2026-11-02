import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { challengePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { startChallenge } from "@zoonk/core/checkpoints/challenge-start";
import { studyBlockStartInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

async function startChallengeRoute(
  request: NextRequest,
  context: RouteContext<"/v1/challenges/[planItemId]/starts">,
) {
  const path = await readPathParams(context, challengePathParamsSchema);

  const body = await readBody(request, studyBlockStartInputSchema);

  const result = await startChallenge({ input: body, planItemId: path.planItemId });

  if (result.status === "ready") {
    return NextResponse.json(result.destination);
  }

  return result.status === "notToday"
    ? errors.conflict("It isn't in today's session")
    : studySessionError(result);
}

export const POST = withApiErrorBoundary(startChallengeRoute);
