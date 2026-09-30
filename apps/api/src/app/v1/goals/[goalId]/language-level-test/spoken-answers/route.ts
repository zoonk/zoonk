import { createErrorResponse, errors, httpStatus, slowDownError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { invalidAudioError, missingAudioError } from "@/lib/language-errors";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { gradeLevelTestSpeech } from "@zoonk/core/language/level-test/speech";
import { safeAsync } from "@zoonk/utils/error";
import { type NextRequest, NextResponse } from "next/server";

/** Reads the recording from the multipart body. */
async function readAudio(request: NextRequest) {
  const { data: form } = await safeAsync(() => request.formData());
  const audio = form?.get("audio");

  if (!(audio instanceof File)) {
    return null;
  }

  return { bytes: new Uint8Array(await audio.arrayBuffer()), mediaType: audio.type };
}

/** The level test's one sentence out loud: checked word by word, it sets the speaking level. */
async function answerLevelTestOutLoud(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test/spoken-answers">,
) {
  const [audio, path] = await Promise.all([
    readAudio(request),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!audio) {
    return missingAudioError();
  }

  const result = await gradeLevelTestSpeech({ audio, goalId: path.data.goalId });

  if (result.status === "invalidAudio") {
    return invalidAudioError();
  }

  if (result.status === "noSpeech") {
    return createErrorResponse({
      code: "NO_SPEECH",
      message: "We couldn't hear any words. Try again.",
      status: httpStatus.unprocessableEntity,
    });
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

  if (result.status !== "ready") {
    return levelTestError(result.status);
  }

  return NextResponse.json({ heard: result.heard, test: result.test });
}

export const POST = withApiErrorBoundary(answerLevelTestOutLoud);
