import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getLessonWaitingState } from "@zoonk/core/lookahead/lesson-waiting-state";
import { NextResponse } from "next/server";

/**
 * Whether a lesson is ready to play, which run is writing it (stream its progress) and, while it
 * isn't ready, a ready alternative from the learner's plan instead of a dead end.
 */
async function getLessonReadiness(
  _request: Request,
  context: RouteContext<"/v1/library/lessons/[lessonId]/readiness">,
) {
  const path = await readPathParams(context, lessonPathParamsSchema);

  const result = await getLessonWaitingState({ lessonId: path.lessonId });

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  return NextResponse.json(result.state, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withApiErrorBoundary(getLessonReadiness);
