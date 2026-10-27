import { createErrorResponse, errors, httpStatus, slowDownError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { invalidAudioError } from "@/lib/language-errors";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { stepPathParamsSchema } from "@/lib/openapi/schemas/steps";
import { readAudioForm, readPathParams } from "@/lib/request-input";
import { isRefusedUsage } from "@zoonk/core/entitlements/contract";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/error-codes";
import { gradeSpokenAnswer } from "@zoonk/core/library/language/grade-spoken-answer";
import {
  spokenAnswerFieldsSchema,
  spokenAnswerGradeSchema,
} from "@zoonk/core/library/language/spoken-answer-contract";
import { type NextRequest, NextResponse } from "next/server";

/**
 * The learner said a "say it out loud" screen's sentence: grade what we heard
 * word by word, explain what didn't match and record the answer.
 */
async function createSpokenAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/steps/[stepId]/spoken-answers">,
) {
  const [form, path] = await Promise.all([
    readAudioForm(request, spokenAnswerFieldsSchema),
    readPathParams(context, stepPathParamsSchema),
  ]);

  const result = await gradeSpokenAnswer({
    audio: form.audio,
    fields: form.fields,
    stepId: path.stepId,
  });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound("Speaking screen not found");
  }

  if (result.status === "invalidAudio") {
    return invalidAudioError();
  }

  if (result.status === "slowDown") {
    return slowDownError({
      details: result,
      message: "Too many answers at once",
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }

  if (isRefusedUsage(result)) {
    return usageDecisionError(result);
  }

  if (result.status === "noSpeech") {
    return createErrorResponse({
      code: LESSON_PLAYER_ERROR_CODES.noSpeech,
      message: "We couldn't hear any words. Try again, or type your answer.",
      status: httpStatus.unprocessableEntity,
    });
  }

  return NextResponse.json(spokenAnswerGradeSchema.parse(result.grade));
}

export const POST = withApiErrorBoundary(createSpokenAnswer);
