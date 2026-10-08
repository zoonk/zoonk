import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { challengePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { planChangeInvalid } from "@/lib/plan-errors";
import { moveChallenge } from "@zoonk/core/checkpoints/challenge-move";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

/** "Move to Monday" from the challenge itself, before its day or on it. */
async function moveChallengeRoute(
  request: NextRequest,
  context: RouteContext<"/v1/challenges/[planItemId]/moves">,
) {
  const path = parsePathParams({ params: await context.params, schema: challengePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, studySessionTimeZoneInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await moveChallenge({ input: body.data, planItemId: path.data.planItemId });

  if (result.status === "moved") {
    return NextResponse.json(result.move);
  }

  if (result.status === "invalid") {
    return planChangeInvalid(result.error);
  }

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return result.status === "notFound"
    ? errors.notFound()
    : errors.conflict("Only a weekly challenge that hasn't started can move, from today on");
}

export const POST = withApiErrorBoundary(moveChallengeRoute);
