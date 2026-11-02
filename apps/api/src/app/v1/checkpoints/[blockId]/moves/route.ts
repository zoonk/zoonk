import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { checkpointPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planChangeInvalid } from "@/lib/plan-errors";
import { readBody, readPathParams } from "@/lib/request-input";
import { moveWeeklyChallenge } from "@zoonk/core/checkpoints/move";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

async function moveChallenge(
  request: NextRequest,
  context: RouteContext<"/v1/checkpoints/[blockId]/moves">,
) {
  const path = await readPathParams(context, checkpointPathParamsSchema);

  const body = await readBody(request, studySessionTimeZoneInputSchema);

  const result = await moveWeeklyChallenge({ blockId: path.blockId, input: body });

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
    : errors.conflict("Only a weekly challenge that hasn't started can move");
}

export const POST = withApiErrorBoundary(moveChallenge);
