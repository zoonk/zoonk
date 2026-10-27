import { createErrorResponse, httpStatus, slowDownError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { invalidAudioError } from "@/lib/language-errors";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { levelTestError } from "@/lib/level-test-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readAudioForm, readPathParams } from "@/lib/request-input";
import { isRefusedUsage } from "@zoonk/core/entitlements/contract";
import { gradeLevelTestSpeech } from "@zoonk/core/language/level-test/speech";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/** The level test's one sentence out loud: checked word by word, it sets the speaking level. */
async function answerLevelTestOutLoud(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/language-level-test/spoken-answers">,
) {
  const [{ audio }, path] = await Promise.all([
    readAudioForm(request, z.object({})),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await gradeLevelTestSpeech({ audio, goalId: path.goalId });

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

  if (isRefusedUsage(result)) {
    return usageDecisionError(result);
  }

  if (result.status !== "ready") {
    return levelTestError(result.status);
  }

  return NextResponse.json({ heard: result.heard, test: result.test });
}

export const POST = withApiErrorBoundary(answerLevelTestOutLoud);
