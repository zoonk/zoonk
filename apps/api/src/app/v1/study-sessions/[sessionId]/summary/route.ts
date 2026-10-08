import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
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
  const path = parsePathParams({
    params: await context.params,
    schema: studySessionPathParamsSchema,
  });

  const query = parseQueryParams(
    new URL(request.url).searchParams,
    studySessionTimeZoneInputSchema,
  );

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getStudySessionSummary({
    input: query.data,
    sessionId: path.data.sessionId,
  });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(serializeStudySessionSummary(result.summary));
}

export const GET = withApiErrorBoundary(getSummary);
