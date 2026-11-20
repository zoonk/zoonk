import { withApiErrorBoundary } from "@/lib/api-handler";
import { studySessionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { claimStudySessionSummaryVisit } from "@zoonk/core/sessions/summary-visit";
import { studySessionSummaryVisitInputSchema } from "@zoonk/core/sessions/summary-visit-contract";
import { type NextRequest, NextResponse } from "next/server";

async function createVisit(
  request: NextRequest,
  context: RouteContext<"/v1/study-sessions/[sessionId]/summary/visit">,
) {
  const [input, path] = await Promise.all([
    readBody(request, studySessionSummaryVisitInputSchema),
    readPathParams(context, studySessionPathParamsSchema),
  ]);

  const result = await claimStudySessionSummaryVisit({ input, sessionId: path.sessionId });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json({ first: result.first });
}

export const POST = withApiErrorBoundary(createVisit);
