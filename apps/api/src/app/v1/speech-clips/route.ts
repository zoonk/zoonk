import { createErrorResponse, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { speechClipRequestSchema } from "@/lib/openapi/schemas/speech-clips";
import { requestSpeechClip } from "@zoonk/core/audio/speech-clip";
import { type NextRequest, NextResponse } from "next/server";

const SERVICE_UNAVAILABLE = 503;

/**
 * Text read aloud in its language. Clips are shared, so this returns the stored one or voices it
 * the first time anyone asks; voicing calls a model, so it only runs from this POST.
 */
async function postSpeechClip(request: NextRequest) {
  const body = await parseBody(request, speechClipRequestSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await requestSpeechClip(body.data);

  if (result.status === "ready") {
    return NextResponse.json(result.clip);
  }

  if (result.status === "invalid") {
    return errors.badRequest("There's no voice for this language or text");
  }

  if (result.status === "failed") {
    return createErrorResponse({
      code: "SPEECH_UNAVAILABLE",
      message: "No voice could read this text this time",
      status: SERVICE_UNAVAILABLE,
    });
  }

  return usageDecisionError(result);
}

export const POST = withApiErrorBoundary(postSpeechClip);
