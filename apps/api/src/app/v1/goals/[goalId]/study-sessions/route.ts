import { httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { openStudyDayError } from "@/lib/open-study-day-error";
import { openStudyDayBodySchema } from "@/lib/openapi/schemas/open-study-day";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { serializeStudySession } from "@/lib/study-session-serializers";
import { openStudyDay } from "@zoonk/core/sessions/open";
import { type NextRequest, NextResponse } from "next/server";

async function openDay(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/study-sessions">,
) {
  const [body, path] = await Promise.all([
    readBody(request, openStudyDayBodySchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await openStudyDay({ ...body, goalId: path.goalId });

  if (result.status !== "opened") {
    return openStudyDayError(result);
  }

  return NextResponse.json(
    {
      ...result,
      localDate: result.localDate.toISOString().slice(0, 10),
      session: serializeStudySession(result.session),
    },
    { status: result.created ? httpStatus.created : httpStatus.ok },
  );
}

export const POST = withApiErrorBoundary(openDay);
