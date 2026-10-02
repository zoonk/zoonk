import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getChallengeTeam } from "@zoonk/core/library/challenges/get-team";
import { NextResponse } from "next/server";

/**
 * The learner's colleagues for a lesson's challenge, kept with their plan. The first read for a
 * plan picks and stores the team, so every later challenge shows the same people.
 */
async function getLessonChallengeTeam(
  _request: Request,
  context: RouteContext<"/v1/library/lessons/[lessonId]/challenge-team">,
) {
  const path = parsePathParams({ params: await context.params, schema: lessonPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const outcome = await getChallengeTeam({ lessonId: path.data.lessonId });

  if (outcome.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (outcome.status === "notFound") {
    return errors.notFound();
  }

  return NextResponse.json(outcome.team, { headers: { "Cache-Control": "no-store" } });
}

export const GET = withApiErrorBoundary(getLessonChallengeTeam);
