import { createErrorResponse, errors, httpStatus, slowDownError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { invalidAudioError, missingAudioError } from "@/lib/language-errors";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { pronunciationReviewPathParamsSchema } from "@/lib/openapi/schemas/pronunciation";
import { parsePathParams } from "@/lib/path-params";
import { answerPronunciationReview } from "@zoonk/core/language/pronunciation/answer";
import { pronunciationAnswerFieldsSchema } from "@zoonk/core/language/pronunciation/contract";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";

/** Reads the recording and its fields from the multipart body. */
async function parseAnswerForm(request: NextRequest) {
  const { data: form } = await safeAsync(() => request.formData());
  const audio = form?.get("audio");

  if (!form || !(audio instanceof File)) {
    return { error: missingAudioError(), success: false as const };
  }

  const fields = pronunciationAnswerFieldsSchema.safeParse(
    Object.fromEntries([...form.entries()].filter(([name]) => name !== "audio")),
  );

  if (!fields.success) {
    return { error: errors.validation(fields.error), success: false as const };
  }

  const bytes = new Uint8Array(await audio.arrayBuffer());

  return { audio: { bytes, mediaType: audio.type }, fields: fields.data, success: true as const };
}

/** The learner said a review word again: grade the sound and move the word along its ladder. */
async function createPronunciationAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/pronunciation-reviews/[reviewId]/answers">,
) {
  const [form, path] = await Promise.all([
    parseAnswerForm(request),
    context.params.then((params) =>
      parsePathParams({ params, schema: pronunciationReviewPathParamsSchema }),
    ),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!form.success) {
    return form.error;
  }

  const result = await answerPronunciationReview({
    audio: form.audio,
    fields: form.fields,
    reviewId: path.data.reviewId,
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

  if (result.status === "limitReached") {
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
