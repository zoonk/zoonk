import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { challengePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { studySessionError } from "@/lib/study-session-errors";
import { startChallenge } from "@zoonk/core/checkpoints/challenge-start";
import { studyBlockStartInputSchema } from "@zoonk/core/sessions/contract";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Starts a challenge on its day and says where it's played. One the bank holds too few questions
 * for answers `QUESTIONS_NEEDED`: POST its generations, wait for the run to end, then start it
 * again with `afterWriting`.
 */
async function startChallengeRoute(
  request: NextRequest,
  context: RouteContext<"/v1/challenges/[planItemId]/starts">,
) {
  const path = parsePathParams({ params: await context.params, schema: challengePathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const body = await parseBody(request, studyBlockStartInputSchema);

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await startChallenge({ input: body.data, planItemId: path.data.planItemId });

  if (result.status === "ready") {
    return NextResponse.json(result.destination);
  }

  return result.status === "notToday"
    ? errors.conflict("It isn't in today's session")
    : studySessionError({ status: result.status });
}

export const POST = withApiErrorBoundary(startChallengeRoute);
