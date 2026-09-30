import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { checkpointPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { planChangeInvalid } from "@/lib/plan-errors";
import { moveWeeklyChallenge } from "@zoonk/core/checkpoints/move";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

/** "Move to Monday": the week's Big Challenge moves to the next Monday, with an undo. */
async function moveChallenge(
  request: NextRequest,
  context: RouteContext<"/v1/checkpoints/[blockId]/moves">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: checkpointPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, studySessionTimeZoneInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await moveWeeklyChallenge({ blockId: path.data.blockId, input: body.data });

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
    : errors.conflict("Only a weekly challenge that hasn't started can move");
}

export const POST = withApiErrorBoundary(moveChallenge);
