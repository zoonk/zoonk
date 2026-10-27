import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { challengeMovePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { planChangeConflict } from "@/lib/plan-errors";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { undoChallengeMove } from "@zoonk/core/checkpoints/challenge-move";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { NextResponse } from "next/server";

/** Undoes a move while the plan is as it left it: the challenge goes back to its day. */
async function undoMoveRoute(
  request: Request,
  context: RouteContext<"/v1/challenges/[planItemId]/moves/[changeId]">,
) {
  const path = await readPathParams(context, challengeMovePathParamsSchema);

  const query = readQueryParams(request, studySessionTimeZoneInputSchema);

  const result = await undoChallengeMove({ ...path, input: query });

  if (result.status === "undone") {
    return NextResponse.json({ planItemId: result.planItemId });
  }

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  return result.status === "notFound" ? errors.notFound() : planChangeConflict();
}

export const DELETE = withApiErrorBoundary(undoMoveRoute);
