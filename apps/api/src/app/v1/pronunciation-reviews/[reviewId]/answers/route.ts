import { createErrorResponse, errors, httpStatus, slowDownError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { invalidAudioError } from "@/lib/language-errors";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { pronunciationReviewPathParamsSchema } from "@/lib/openapi/schemas/pronunciation";
import { readAudioForm, readPathParams } from "@/lib/request-input";
import { isRefusedUsage } from "@zoonk/core/entitlements/contract";
import { answerPronunciationReview } from "@zoonk/core/language/pronunciation/answer";
import { pronunciationAnswerFieldsSchema } from "@zoonk/core/language/pronunciation/contract";
import { type NextRequest, NextResponse } from "next/server";

async function createPronunciationAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/pronunciation-reviews/[reviewId]/answers">,
) {
  const [form, path] = await Promise.all([
    readAudioForm(request, pronunciationAnswerFieldsSchema),
    readPathParams(context, pronunciationReviewPathParamsSchema),
  ]);

  const result = await answerPronunciationReview({
    audio: form.audio,
    fields: form.fields,
    reviewId: path.reviewId,
  });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound("Pronunciation review not found");
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
      code: "NO_SPEECH",
      message: "We couldn't hear the word. Try again.",
      status: httpStatus.unprocessableEntity,
    });
  }

  return NextResponse.json(result.grade);
}

export const POST = withApiErrorBoundary(createPronunciationAnswer);
