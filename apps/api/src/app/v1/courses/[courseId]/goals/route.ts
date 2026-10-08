import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { startGoalGeneration } from "@/lib/goal-content";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { goalRefusedError } from "@/lib/plan-errors";
import { courseGoalStartInputSchema } from "@zoonk/core/goals/course-start-contract";
import { startCourseGoal } from "@zoonk/core/goals/start-course";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

/** A run that couldn't start is logged; the client can start it again for that goal. */
async function startCourseGoalGeneration(goal: Parameters<typeof startGoalGeneration>[0]["goal"]) {
  const { error } = await safeAsync(() => startGoalGeneration({ goal }));

  if (error) {
    logError("[courseGoals] The goal's run didn't start:", error);
  }
}

/**
 * Starts a course (or one of its chapters) as the learner's goal, with its plan built from the
 * course, and the goal's run writing ahead what the plan needs. The learner's goal already on the
 * course comes back instead of a second one. A run that couldn't start never undoes the goal:
 * POST /goals/{goalId}/generations starts it.
 */
async function startFromCourse(
  request: NextRequest,
  context: RouteContext<"/v1/courses/[courseId]/goals">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, courseGoalStartInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: coursePathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await startCourseGoal({ courseId: path.data.courseId, input: body.data });

  switch (result.status) {
    case "created":
      await startCourseGoalGeneration(result.goal);
      return NextResponse.json(result.goal, { status: CREATED });
    case "existing":
      return NextResponse.json(result.goal);
    case "refused":
      return result.refusals[0] ? goalRefusedError(result.refusals[0].decision) : errors.internal();
    case "unauthorized":
      return errors.unauthorized();
    case "notFound":
      return errors.notFound();
    default:
      return result satisfies never;
  }
}

export const POST = withApiErrorBoundary(startFromCourse);
