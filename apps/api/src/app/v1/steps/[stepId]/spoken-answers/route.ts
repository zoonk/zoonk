import { createErrorResponse, errors, httpStatus, slowDownError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { invalidAudioError, missingAudioError } from "@/lib/language-errors";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { stepPathParamsSchema } from "@/lib/openapi/schemas/step-variants";
import { parsePathParams } from "@/lib/path-params";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/contract";
import { gradeSpokenAnswer } from "@zoonk/core/library/language/grade-spoken-answer";
import { spokenAnswerFieldsSchema } from "@zoonk/core/library/language/spoken-answer-contract";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";

/** Reads the recording and its fields from the multipart body. */
async function parseSpokenAnswerForm(request: NextRequest) {
  const { data: form } = await safeAsync(() => request.formData());
  const audio = form?.get("audio");

  if (!form || !(audio instanceof File)) {
    return { error: missingAudioError(), success: false as const };
  }

  const fields = spokenAnswerFieldsSchema.safeParse(
    Object.fromEntries([...form.entries()].filter(([name]) => name !== "audio")),
  );

  if (!fields.success) {
    return { error: errors.validation(fields.error), success: false as const };
  }

  const bytes = new Uint8Array(await audio.arrayBuffer());

  return { audio: { bytes, mediaType: audio.type }, fields: fields.data, success: true as const };
}

/**
 * The learner said a "say it out loud" screen's sentence: grade what we heard
 * word by word, explain what didn't match and record the answer.
 */
async function createSpokenAnswer(
  request: NextRequest,
  context: RouteContext<"/v1/steps/[stepId]/spoken-answers">,
) {
  const [form, path] = await Promise.all([
    parseSpokenAnswerForm(request),
    context.params.then((params) => parsePathParams({ params, schema: stepPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!form.success) {
    return form.error;
  }

  const result = await gradeSpokenAnswer({
    audio: form.audio,
    fields: form.fields,
    stepId: path.data.stepId,
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

  if (result.status === "limitReached") {
    return usageDecisionError(result);
  }

  if (result.status === "noSpeech") {
    return createErrorResponse({
      code: LESSON_PLAYER_ERROR_CODES.noSpeech,
      message: "We couldn't hear any words. Try again, or type your answer.",
      status: httpStatus.unprocessableEntity,
    });
  }

  return NextResponse.json(result.grade);
}

export const POST = withApiErrorBoundary(createSpokenAnswer);
