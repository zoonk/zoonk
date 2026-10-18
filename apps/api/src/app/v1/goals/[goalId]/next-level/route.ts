import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startGoalWork } from "@/lib/goal-content";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { continueGoalAtNextLevel } from "@zoonk/core/goals/continue-next-level";
import { NextResponse } from "next/server";

const CREATED = 201;

type Refusal = Exclude<Awaited<ReturnType<typeof continueGoalAtNextLevel>>, { status: "created" }>;

function refuse({ status }: Refusal) {
  if (status === "unauthorized") {
    return errors.unauthorized();
  }

  if (status === "notFound") {
    return errors.notFound();
  }

  if (status === "refused") {
    return errors.conflict("The next level's goal couldn't be created");
  }

  return status === "notFinished"
    ? errors.conflict("Finish the plan's lessons first")
    : errors.unprocessableEntity("This goal has no next level to continue at");
}

/**
 * "Continue at Beginner" once a plan is done: the finished goal is completed and a goal for the
 * next level of its course takes its place; its research and curriculum start right away.
 */
async function postNextLevel(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/next-level">,
) {
  const path = parsePathParams({ params: await context.params, schema: goalPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await continueGoalAtNextLevel(path.data.goalId);

  if (result.status !== "created") {
    return refuse(result);
  }

  const { generations, research } = await startGoalWork([result.goal]);

  return NextResponse.json({ generations, goal: result.goal, research }, { status: CREATED });
}

export const POST = withApiErrorBoundary(postNextLevel);
