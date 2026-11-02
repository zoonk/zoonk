import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startGoalWork } from "@/lib/goal-content";
import { goalRefusedError, planErrorCodes } from "@/lib/plan-errors";
import { readBody } from "@/lib/request-input";
import { goalCreateInputSchema } from "@zoonk/core/goals/contract";
import { type GoalRefusal } from "@zoonk/core/goals/create";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { createOnboardingGoals } from "@zoonk/core/view-models/onboarding/create-goals";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

function toRefusalView(refusal: GoalRefusal) {
  const { decision, index } = refusal;

  return {
    index,
    limit: decision.status === "limitReached" ? decision.limit : null,
    retryAfterSeconds: decision.status === "slowDown" ? decision.retryAfterSeconds : null,
  };
}

async function listGoals() {
  const list = await listCurrentUserGoals();
  return list ? NextResponse.json(list) : errors.unauthorized();
}

async function createGoal(request: NextRequest) {
  const parsed = await readBody(request, goalCreateInputSchema);

  const result = await createOnboardingGoals(parsed);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "invalidReference") {
    return createErrorResponse({
      code: planErrorCodes.goalReferenceNotFound,
      message: "The exam or course isn't available",
      status: httpStatus.unprocessableEntity,
    });
  }

  if (result.status === "refused") {
    const [first] = result.refused;
    return first ? goalRefusedError(first.decision) : errors.internal();
  }

  const { generations, research } = await startGoalWork(result.goals);

  return NextResponse.json(
    {
      generations,
      goals: result.goals,
      refused: result.refused.map((refusal) => toRefusalView(refusal)),
      research,
    },
    { status: CREATED },
  );
}

export const GET = withApiErrorBoundary(listGoals);
export const POST = withApiErrorBoundary(createGoal);
