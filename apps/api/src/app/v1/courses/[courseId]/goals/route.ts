import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startGoalGeneration, startGoalWork } from "@/lib/goal-content";
import { coursePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { goalRefusedError } from "@/lib/plan-errors";
import { readBody, readPathParams } from "@/lib/request-input";
import { type GoalView } from "@zoonk/core/goals/contract";
import { courseGoalStartInputSchema } from "@zoonk/core/goals/course-start-contract";
import { isResearchedCourseStart } from "@zoonk/core/goals/research";
import { startCourseGoal } from "@zoonk/core/goals/start-course";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

/**
 * Starts the goal's run, after research for an exam course nobody stored an exam for. A run that
 * couldn't start is logged; the client can start it again for that goal.
 */
async function startCourseGoalGeneration(goal: GoalView) {
  const { error } = await safeAsync(async () => {
    await (isResearchedCourseStart(goal) ? startGoalWork([goal]) : startGoalGeneration({ goal }));
  });

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
    readBody(request, courseGoalStartInputSchema),
    readPathParams(context, coursePathParamsSchema),
  ]);

  const result = await startCourseGoal({ courseId: path.courseId, input: body });

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
