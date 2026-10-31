import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startGoalWork } from "@/lib/goal-content";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
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

async function postNextLevel(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/next-level">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await continueGoalAtNextLevel(path.goalId);

  if (result.status !== "created") {
    return refuse(result);
  }

  const { generations, research } = await startGoalWork([result.goal]);

  return NextResponse.json({ generations, goal: result.goal, research }, { status: CREATED });
}

export const POST = withApiErrorBoundary(postNextLevel);
