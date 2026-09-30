import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { studyBlockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { scheduleSessionPreparation } from "@/lib/session-preparation";
import { studySessionError } from "@/lib/study-session-errors";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { startStudyBlock } from "@zoonk/core/sessions/start-block";
import { type NextRequest, NextResponse } from "next/server";

/** Starts or resumes a block; a guardian's daily limit is checked before anything new starts. */
async function createStart(
  request: NextRequest,
  context: RouteContext<"/v1/study-sessions/[sessionId]/blocks/[blockId]/starts">,
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

  const result = await startStudyBlock({ ...path.data, input: body.data });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  // A session under way gets this session's and the next one's lessons ready in the background.
  await scheduleSessionPreparation(path.data.sessionId);

  return NextResponse.json(result.block);
}

export const POST = withApiErrorBoundary(createStart);
