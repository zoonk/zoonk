import { withApiErrorBoundary } from "@/lib/api-handler";
import { studyBlockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeStudyBlockCompletion } from "@zoonk/core/sessions/completion-contract";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { finishStudyBlock } from "@zoonk/core/sessions/finish-block";
import { type NextRequest, NextResponse } from "next/server";

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

  return NextResponse.json(serializeStudyBlockCompletion(result.completion));
}

export const POST = withApiErrorBoundary(createCompletion);
