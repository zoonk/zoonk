import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { studySessionTimeZoneInputSchema } from "@zoonk/core/sessions/contract";
import { addRefreshPracticeBlock } from "@zoonk/core/sessions/refresh-practice";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

async function createRefreshPractice(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/refresh-practice">,
) {
  const [body, path] = await Promise.all([
    readBody(request, studySessionTimeZoneInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await addRefreshPracticeBlock({ goalId: path.goalId, input: body });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(
    { block: result.block, sessionId: result.sessionId },
    { status: CREATED },
  );
}

export const POST = withApiErrorBoundary(createRefreshPractice);
