import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { learnerAccessError } from "@/lib/learner-errors";
import { scheduleLessonWriting } from "@/lib/lesson-writing";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { scheduleGoalPreparation } from "@/lib/session-preparation";
import { placementCompletionInputSchema } from "@zoonk/core/learner/placement/contract";
import { finishGoalPlacement } from "@zoonk/core/learner/placement/finish";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Ends placement ("Stop anytime" or "Start from scratch") and returns each phase's start. The
 * lesson the plan now opens with starts being written, guests' included, counted as its start
 * like opening it: Day 1 opens it minutes later. A learner with an account also gets Day 1's next
 * lessons and the next study day's first ones written, as a session's preparation would.
 */
async function completePlacement(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/placement/completion">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, placementCompletionInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await finishGoalPlacement({ goalId: path.data.goalId, input: body.data });

  if (result.status !== "ready") {
    return learnerAccessError(result.status);
  }

  if (result.firstLessonId) {
    scheduleLessonWriting(result.firstLessonId);
  }

  await scheduleGoalPreparation(path.data.goalId);

  return NextResponse.json(result.completion);
}

export const POST = withApiErrorBoundary(completePlacement);
