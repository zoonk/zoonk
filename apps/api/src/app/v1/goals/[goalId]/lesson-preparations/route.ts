import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { startGoalPreparation } from "@/lib/session-preparation";
import { NextResponse } from "next/server";

const ACCEPTED = 202;

/**
 * Gets a goal's first lessons written before its first study session is built: clients call it
 * when placement ends (the web app does, and placement's completion does for API clients), so Day
 * 1's lessons are ready when the learner taps them. Never on a screen view. Guests get only the
 * plan's first lesson, counted as its start.
 */
async function createLessonPreparation(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/lesson-preparations">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await startGoalPreparation({ goalId: path.data.goalId });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  return NextResponse.json({ preparationId: result.preparationId }, { status: ACCEPTED });
}

export const POST = withApiErrorBoundary(createLessonPreparation);
