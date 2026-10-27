import { withApiErrorBoundary } from "@/lib/api-handler";
import { studyBlockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { scheduleSessionPreparation } from "@/lib/session-preparation";
import { studySessionError } from "@/lib/study-session-errors";
import { studyBlockStartInputSchema } from "@zoonk/core/sessions/contract";
import { startStudyBlock } from "@zoonk/core/sessions/start-block";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Starts or resumes a block; the learner's daily limit is checked before anything new starts. A
 * phase challenge held by earlier lessons or a phase challenge answers `EARLIER_FIRST`, with
 * `details.reason` saying which. A challenge whose questions aren't written yet answers
 * `QUESTIONS_NEEDED`: POST its generations, wait for the run, then start it again with `afterWriting`.
 */
async function createStart(
  request: NextRequest,
  context: RouteContext<"/v1/study-sessions/[sessionId]/blocks/[blockId]/starts">,
) {
  const [body, path] = await Promise.all([
    readBody(request, studyBlockStartInputSchema),
    readPathParams(context, studyBlockPathParamsSchema),
  ]);

  const result = await startStudyBlock({ ...path, input: body });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  // A session under way gets this session's and the next one's lessons ready in the background.
  await scheduleSessionPreparation(path.sessionId);

  return NextResponse.json(result.block);
}

export const POST = withApiErrorBoundary(createStart);
