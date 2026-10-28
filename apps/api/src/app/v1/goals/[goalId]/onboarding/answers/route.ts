import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startGoalWork } from "@/lib/goal-content";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { scheduleGoalPreparation } from "@/lib/session-preparation";
import { answerOnboardingQuestion } from "@zoonk/core/view-models/onboarding/answer";
import { onboardingAnswerInputSchema } from "@zoonk/core/view-models/onboarding/contract";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { type NextRequest, NextResponse } from "next/server";

async function createOnboardingAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/onboarding/answers">,
) {
  const [body, path] = await Promise.all([
    readBody(request, onboardingAnswerInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await answerOnboardingQuestion({ goalId: path.goalId, input: body });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "invalid") {
    return errors.unprocessableEntity("This answer can't be applied to the goal");
  }

  if (result.movedTo) {
    await startGoalWork([result.movedTo]);
  }

  const goalId = result.movedTo?.id ?? path.goalId;

  if (body.question === "schedule") {
    await scheduleGoalPreparation(goalId);
  }

  const onboarding = await getOnboarding({ goalId });

  return onboarding.status === "ready"
    ? NextResponse.json(onboarding.onboarding)
    : errors.notFound();
}

export const POST = withApiErrorBoundary(createOnboardingAnswer);
