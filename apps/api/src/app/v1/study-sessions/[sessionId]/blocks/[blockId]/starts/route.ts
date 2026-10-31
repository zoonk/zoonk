import { withApiErrorBoundary } from "@/lib/api-handler";
import { studyBlockPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { studyBlockStartInputSchema } from "@zoonk/core/sessions/contract";
import { startStudyBlock } from "@zoonk/core/sessions/start-block";
import { type NextRequest, NextResponse } from "next/server";

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

  return NextResponse.json(result.block);
}

export const POST = withApiErrorBoundary(createStart);
