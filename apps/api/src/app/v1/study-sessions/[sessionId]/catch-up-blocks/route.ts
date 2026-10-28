import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeStudySession } from "@/lib/study-session-serializers";
import { catchUpToday } from "@zoonk/core/sessions/catch-up";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

async function createCatchUpBlocks(
  request: NextRequest,
  context: RouteContext<"/v1/study-sessions/[sessionId]/catch-up-blocks">,
) {
  const [body, path] = await Promise.all([
    readBody(request, studySessionTimeZoneInputSchema),
    readPathParams(context, studySessionPathParamsSchema),
  ]);

  const result = await catchUpToday({ input: body, sessionId: path.sessionId });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(serializeStudySession(result.session));
}

export const POST = withApiErrorBoundary(createCatchUpBlocks);
