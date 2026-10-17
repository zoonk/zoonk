import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { checkpointMovePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { planChangeConflict } from "@/lib/plan-errors";
import { parseQueryParams } from "@/lib/query-params";
import { undoWeeklyChallengeMove } from "@zoonk/core/checkpoints/move";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { NextResponse } from "next/server";

/** Undoes a move while the plan is as it left it: the challenge goes back to its day. */
async function undoMove(
  request: Request,
  context: RouteContext<"/v1/checkpoints/[blockId]/moves/[changeId]">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: checkpointMovePathParamsSchema,
  });

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

  const result = await undoWeeklyChallengeMove({ ...path.data, input: query.data });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "conflict") {
    return planChangeConflict();
  }

  return new NextResponse(null, { status: 204 });
}

export const DELETE = withApiErrorBoundary(undoMove);
