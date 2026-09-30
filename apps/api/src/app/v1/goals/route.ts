import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { startGoalWork } from "@/lib/goal-content";
import { goalRefusedError, planErrorCodes } from "@/lib/plan-errors";
import { goalCreateInputSchema } from "@zoonk/core/goals/contract";
import { type GoalRefusal } from "@zoonk/core/goals/create";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { createOnboardingGoals } from "@zoonk/core/view-models/onboarding/create-goals";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

function toRefusalView(refusal: GoalRefusal) {
  const { decision, index } = refusal;

  return decision.status === "slowDown"
    ? { index, limit: null, retryAfterSeconds: decision.retryAfterSeconds }
    : { index, limit: decision.limit, retryAfterSeconds: null };
}

/** The learner's goals, the main one first, with the day's total time. */
async function listGoals() {
  const list = await listCurrentUserGoals();
  return list ? NextResponse.json(list) : errors.unauthorized();
}

/** Creates one goal, or several that share the day's time ("ENEM and English"). */
async function createGoal(request: NextRequest) {
  const parsed = await parseBody(request, goalCreateInputSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await createOnboardingGoals(parsed.data);

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
