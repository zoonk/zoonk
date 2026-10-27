import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { essayPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams, readQueryParams } from "@/lib/request-input";
import { getEssay } from "@zoonk/core/exams/essays/get";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { NextResponse } from "next/server";

/** Returns a writing block: the essay prompt, its rubric and the graded drafts so far. */
async function getEssayRoute(request: Request, context: RouteContext<"/v1/essays/[blockId]">) {
  const path = await readPathParams(context, essayPathParamsSchema);

  const query = readQueryParams(request, studySessionTimeZoneInputSchema);

  const result = await getEssay({ blockId: path.blockId, timeZone: query.timeZone });

  if (result.status !== "ready") {
    return examError(result);
  }

  return NextResponse.json(result.essay);
}

export const GET = withApiErrorBoundary(getEssayRoute);
