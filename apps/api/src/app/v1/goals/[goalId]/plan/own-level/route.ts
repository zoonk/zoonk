import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { scheduleGoalPreparation } from "@/lib/session-preparation";
import { changeOwnLevel } from "@zoonk/core/plans/own-level";
import { ownLevelChangeInputSchema } from "@zoonk/core/plans/own-level-contract";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Changes the learner's own level from the plan: lower adds foundations with an undo, higher
 * offers test-outs. Past work is never undone. The foundations it adds start being written right
 * away, as a session's preparation writes what the plan has soon.
 */
async function updateOwnLevel(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/plan/own-level">,
) {
  const [body, path] = await Promise.all([
    readBody(request, ownLevelChangeInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await changeOwnLevel({ goalId: path.goalId, input: body });

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  await scheduleGoalPreparation(path.goalId);

  return NextResponse.json(result.ownLevel);
}

export const POST = withApiErrorBoundary(updateOwnLevel);
