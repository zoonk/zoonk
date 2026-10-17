import { errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { openStudyDayError } from "@/lib/open-study-day-error";
import { openStudyDayBodySchema } from "@/lib/openapi/schemas/open-study-day";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { serializeStudySession } from "@/lib/study-session-serializers";
import { openStudyDay } from "@zoonk/core/sessions/open";
import { type NextRequest, NextResponse } from "next/server";

/** Explicitly opens the selected owned day; GET previews never create or refresh it. */
async function openDay(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/study-sessions">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, openStudyDayBodySchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await openStudyDay({ ...body.data, goalId: path.data.goalId });

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
