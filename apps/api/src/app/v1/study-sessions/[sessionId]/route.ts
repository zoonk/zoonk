import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { studySessionError } from "@/lib/study-session-errors";
import { serializeStudySession } from "@/lib/study-session-serializers";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { getStudySession } from "@zoonk/core/sessions/get";
import { NextResponse } from "next/server";

/** Returns one of the learner's study sessions with its blocks and progress. */
async function getSessionById(
  request: Request,
  context: RouteContext<"/v1/study-sessions/[sessionId]">,
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

  const result = await getStudySession({ input: query.data, sessionId: path.data.sessionId });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(serializeStudySession(result.session));
}

export const GET = withApiErrorBoundary(getSessionById);
