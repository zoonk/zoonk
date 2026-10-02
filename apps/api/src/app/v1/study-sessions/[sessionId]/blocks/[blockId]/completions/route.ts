import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { studyBlockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
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
    parseBody(request, studySessionTimeZoneInputSchema),
    context.params.then((params) =>
      parsePathParams({ params, schema: studyBlockPathParamsSchema }),
    ),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await finishStudyBlock({ ...path.data, input: body.data });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  // The last block ended the session: prepare the next one.
  if (result.completion.sessionCompleted) {
    await scheduleSessionPreparation(path.data.sessionId);
  }

  return NextResponse.json(serializeStudyBlockCompletion(result.completion));
}

export const POST = withApiErrorBoundary(createCompletion);
