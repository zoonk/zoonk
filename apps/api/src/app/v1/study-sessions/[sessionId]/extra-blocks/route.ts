import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { addExtraStudyBlock } from "@zoonk/core/sessions/extra-block";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

async function createExtraBlock(
  request: NextRequest,
  context: RouteContext<"/v1/study-sessions/[sessionId]/extra-blocks">,
) {
  const [body, path] = await Promise.all([
    readBody(request, studySessionTimeZoneInputSchema),
    readPathParams(context, studySessionPathParamsSchema),
  ]);

  const result = await addExtraStudyBlock({ input: body, sessionId: path.sessionId });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(result.block, { status: CREATED });
}

export const POST = withApiErrorBoundary(createExtraBlock);
