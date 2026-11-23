import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { startGoalWork } from "@/lib/goal-content";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { dayTooShort } from "@/lib/plan-errors";
import { profileQuestionError } from "@/lib/profile-question-errors";
import { readBody, readPathParams } from "@/lib/request-input";
import { answerOnboardingQuestion } from "@zoonk/core/view-models/onboarding/answer";
import { onboardingAnswerInputSchema } from "@zoonk/core/view-models/onboarding/contract";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { getLocaleFromRequest } from "@zoonk/utils/locale-request";
import { type NextRequest, NextResponse } from "next/server";

async function createOnboardingAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/onboarding/answers">,
) {
  const [body, path] = await Promise.all([
    readBody(request, onboardingAnswerInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await answerOnboardingQuestion({
    goalId: path.goalId,
    input: body,
    locale: getLocaleFromRequest({ acceptLanguage: request.headers.get("accept-language") }),
  });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "invalid") {
    return errors.unprocessableEntity("This answer can't be applied to the goal");
  }

  if (result.status === "memoryOff" || result.status === "consentRequired") {
    return profileQuestionError(result.status);
  }

  if (result.status === "dayTooShort") {
    return dayTooShort(result);
  }

  if (result.movedTo?.created) {
    await startGoalWork([result.movedTo.goal]);
  }

  const goalId = result.movedTo?.goal.id ?? path.goalId;

  const onboarding = await getOnboarding({
    goalId,
    locale: getLocaleFromRequest({ acceptLanguage: request.headers.get("accept-language") }),
  });

  return onboarding.status === "ready"
    ? NextResponse.json(onboarding.onboarding)
    : errors.notFound();
}

export const POST = withApiErrorBoundary(createOnboardingAnswer);
