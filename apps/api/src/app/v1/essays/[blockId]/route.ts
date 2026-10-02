import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { essayPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { getEssay } from "@zoonk/core/exams/essays/get";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { NextResponse } from "next/server";

/** Returns a writing block: the essay prompt, its rubric and the graded drafts so far. */
async function getEssayRoute(request: Request, context: RouteContext<"/v1/essays/[blockId]">) {
  const path = parsePathParams({ params: await context.params, schema: essayPathParamsSchema });

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

  const result = await getEssay({ blockId: path.data.blockId, timeZone: query.data.timeZone });

  if (result.status !== "ready") {
    return examError(result);
  }

  return NextResponse.json(result.essay);
}

export const GET = withApiErrorBoundary(getEssayRoute);
