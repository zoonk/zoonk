import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
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
    parseBody(request, ownLevelChangeInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await changeOwnLevel({ goalId: path.data.goalId, input: body.data });

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  await scheduleGoalPreparation(path.data.goalId);

  return NextResponse.json(result.ownLevel);
}

export const POST = withApiErrorBoundary(updateOwnLevel);
