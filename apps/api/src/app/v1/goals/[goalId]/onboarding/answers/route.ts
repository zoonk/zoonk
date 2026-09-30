import { underMinimumAgeError } from "@/lib/access-error-codes";
import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { answerOnboardingQuestion } from "@zoonk/core/view-models/onboarding/answer";
import { onboardingAnswerInputSchema } from "@zoonk/core/view-models/onboarding/contract";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { type NextRequest, NextResponse } from "next/server";

/** Saves one onboarding answer and returns the screens still ahead. */
async function createOnboardingAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/onboarding/answers">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, onboardingAnswerInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const { goalId } = path.data;
  const result = await answerOnboardingQuestion({ goalId, input: body.data });

  if (result.status === "accountDeleted") {
    return underMinimumAgeError();
  }

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "invalid") {
    return errors.unprocessableEntity("This answer can't be applied to the goal");
  }

  const onboarding = await getOnboarding({ goalId });

  return onboarding.status === "ready"
    ? NextResponse.json(onboarding.onboarding)
    : errors.notFound();
}

export const POST = withApiErrorBoundary(createOnboardingAnswer);
