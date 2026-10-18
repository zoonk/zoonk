import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { studySessionError } from "@/lib/study-session-errors";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { addRefreshPracticeBlock } from "@zoonk/core/sessions/refresh-practice";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

/** "Refresh now": a capped bonus block on the goal's fading skills in today's session. */
async function createRefreshPractice(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/refresh-practice">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, studySessionTimeZoneInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await addRefreshPracticeBlock({ goalId: path.data.goalId, input: body.data });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(
    { block: result.block, sessionId: result.sessionId },
    { status: CREATED },
  );
}

export const POST = withApiErrorBoundary(createRefreshPractice);
