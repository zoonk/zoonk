import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeStudySession } from "@/lib/study-session-serializers";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { getStudySession } from "@zoonk/core/sessions/get";
import { NextResponse } from "next/server";

async function getSessionById(
  request: Request,
  context: RouteContext<"/v1/study-sessions/[sessionId]">,
) {
  const path = await readPathParams(context, studySessionPathParamsSchema);

  const query = readQueryParams(request, studySessionTimeZoneInputSchema);

  const result = await getStudySession({ input: query, sessionId: path.sessionId });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(serializeStudySession(result.session));
}

export const GET = withApiErrorBoundary(getSessionById);
