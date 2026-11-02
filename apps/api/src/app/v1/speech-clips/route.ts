import { createErrorResponse, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { toApiImageUrl } from "@/lib/file-urls";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import {
  speechClipRequestSchema,
  speechClipResponseSchema,
} from "@/lib/openapi/schemas/speech-clips";
import { readBody } from "@/lib/request-input";
import { requestSpeechClip } from "@zoonk/core/audio/speech-clip";
import { type NextRequest, NextResponse } from "next/server";

const SERVICE_UNAVAILABLE = 503;

async function postSpeechClip(request: NextRequest) {
  const body = await readBody(request, speechClipRequestSchema);

  const result = await requestSpeechClip(body);

  if (result.status === "ready") {
    return NextResponse.json(
      speechClipResponseSchema.parse({ ...result.clip, url: toApiImageUrl(result.clip.url) }),
    );
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
