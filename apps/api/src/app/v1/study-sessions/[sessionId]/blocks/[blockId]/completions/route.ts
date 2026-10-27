import { withApiErrorBoundary } from "@/lib/api-handler";
import { studyBlockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { scheduleSessionPreparation } from "@/lib/session-preparation";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeStudyBlockCompletion } from "@zoonk/core/sessions/completion-contract";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { finishStudyBlock } from "@zoonk/core/sessions/finish-block";
import { type NextRequest, NextResponse } from "next/server";

/** Finishes a block and returns its completion moment. */
async function createCompletion(
  request: NextRequest,
  context: RouteContext<"/v1/study-sessions/[sessionId]/blocks/[blockId]/completions">,
) {
  const [body, path] = await Promise.all([
    readBody(request, studySessionTimeZoneInputSchema),
    readPathParams(context, studyBlockPathParamsSchema),
  ]);

  const result = await finishStudyBlock({ ...path, input: body });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  // The last block ended the session: prepare the next one.
  if (result.completion.sessionCompleted) {
    await scheduleSessionPreparation(path.sessionId);
  }

  return NextResponse.json(serializeStudyBlockCompletion(result.completion));
}

export const POST = withApiErrorBoundary(createCompletion);
