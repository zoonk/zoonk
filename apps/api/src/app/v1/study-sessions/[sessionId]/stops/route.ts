import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
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
    parseBody(request, studySessionTimeZoneInputSchema),
    context.params.then((params) =>
      parsePathParams({ params, schema: studySessionPathParamsSchema }),
    ),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await stopStudySession({ input: body.data, sessionId: path.data.sessionId });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  // What's left waits for later: get it ready.
  await scheduleSessionPreparation(path.data.sessionId);

  return NextResponse.json(serializeStudySessionSummary(result.summary));
}

export const POST = withApiErrorBoundary(createStop);
