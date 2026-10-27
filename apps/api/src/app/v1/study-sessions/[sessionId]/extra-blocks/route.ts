import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { addExtraStudyBlock } from "@zoonk/core/sessions/extra-block";
import { NextResponse } from "next/server";

const CREATED = 201;

/** "10 more minutes": adds one bonus block after the day's session, capped. */
async function createExtraBlock(
  _request: Request,
  context: RouteContext<"/v1/study-sessions/[sessionId]/extra-blocks">,
) {
  const path = await readPathParams(context, studySessionPathParamsSchema);

  const result = await addExtraStudyBlock({ sessionId: path.sessionId });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(result.block, { status: CREATED });
}

export const POST = withApiErrorBoundary(createExtraBlock);
