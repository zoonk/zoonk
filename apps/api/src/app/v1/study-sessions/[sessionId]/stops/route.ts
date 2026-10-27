import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { scheduleSessionPreparation } from "@/lib/session-preparation";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeStudySessionSummary } from "@/lib/study-session-serializers";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { stopStudySession } from "@zoonk/core/sessions/stop";
import { type NextRequest, NextResponse } from "next/server";

/** "Stop for today": what was done counts, the rest waits, and the summary so far comes back. */
async function createStop(
  request: NextRequest,
  context: RouteContext<"/v1/study-sessions/[sessionId]/stops">,
) {
  const [body, path] = await Promise.all([
    readBody(request, studySessionTimeZoneInputSchema),
    readPathParams(context, studySessionPathParamsSchema),
  ]);

  const result = await stopStudySession({ input: body, sessionId: path.sessionId });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  // What's left waits for later: get it ready.
  await scheduleSessionPreparation(path.sessionId);

  return NextResponse.json(serializeStudySessionSummary(result.summary));
}

export const POST = withApiErrorBoundary(createStop);
