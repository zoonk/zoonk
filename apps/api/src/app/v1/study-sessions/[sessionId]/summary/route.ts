import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeStudySessionSummary } from "@/lib/study-session-serializers";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { getStudySessionSummary } from "@zoonk/core/sessions/summary";
import { NextResponse } from "next/server";

/** Returns what changed in a session: the end-of-session summary. */
async function getSummary(
  request: Request,
  context: RouteContext<"/v1/study-sessions/[sessionId]/summary">,
) {
  const path = await readPathParams(context, studySessionPathParamsSchema);

  const query = readQueryParams(request, studySessionTimeZoneInputSchema);

  const result = await getStudySessionSummary({ input: query, sessionId: path.sessionId });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(serializeStudySessionSummary(result.summary));
}

export const GET = withApiErrorBoundary(getSummary);
