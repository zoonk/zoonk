import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { challengePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planChangeInvalid } from "@/lib/plan-errors";
import { readBody, readPathParams } from "@/lib/request-input";
import { moveChallenge } from "@zoonk/core/checkpoints/challenge-move";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

/** "Move to Monday" from the challenge itself, before its day or on it. */
async function moveChallengeRoute(
  request: NextRequest,
  context: RouteContext<"/v1/challenges/[planItemId]/moves">,
) {
  const path = await readPathParams(context, challengePathParamsSchema);

  const body = await readBody(request, studySessionTimeZoneInputSchema);

  const result = await moveChallenge({ input: body, planItemId: path.planItemId });

  if (result.status === "moved") {
    return NextResponse.json(result.move);
  }

  if (result.status === "invalid") {
    return planChangeInvalid(result);
  }

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return result.status === "notFound"
    ? errors.notFound()
    : errors.conflict("Only a weekly challenge that hasn't started can move, from today on");
}

export const POST = withApiErrorBoundary(moveChallengeRoute);
