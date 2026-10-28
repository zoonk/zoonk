import { withApiErrorBoundary } from "@/lib/api-handler";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { studySessionError } from "@/lib/study-session-errors";
import { addAreaPracticeBlock } from "@zoonk/core/sessions/area-practice";
import { areaPracticeInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

async function createAreaPractice(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/area-practice">,
) {
  const [body, path] = await Promise.all([
    readBody(request, areaPracticeInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await addAreaPracticeBlock({ goalId: path.goalId, input: body });

  if (result.status !== "ready") {
    return studySessionError(result);
  }

  return NextResponse.json(
    { block: result.block, sessionId: result.sessionId },
    { status: CREATED },
  );
}

export const POST = withApiErrorBoundary(createAreaPractice);
