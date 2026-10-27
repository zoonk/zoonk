import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { plusRequiredError, usageDecisionError } from "@/lib/lesson-player-errors";
import { challengePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { challengeQuestionsWorkflow } from "@/workflows/v2/goals/challenge-questions-workflow";
import { requestChallengeQuestions } from "@zoonk/core/checkpoints/challenge-questions";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

const ACCEPTED = 202;

/**
 * Gets a challenge's questions ready when the learner starts it and the bank holds too few:
 * `ready` when it has them, otherwise a run writes what it lacks of its ten (a run already
 * writing them is joined). Each start counts as small AI help.
 */
async function createChallengeGeneration(
  _request: Request,
  context: RouteContext<"/v1/challenges/[planItemId]/generations">,
) {
  const path = await readPathParams(context, challengePathParamsSchema);

  const result = await requestChallengeQuestions(path);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "refused") {
    return usageDecisionError(result.decision);
  }

  if (result.status === "plusRequired") {
    return plusRequiredError();
  }

  if (result.status === "ready") {
    return NextResponse.json({ generationId: null, status: "ready" });
  }

  const run = await start(challengeQuestionsWorkflow, [
    {
      analytics: result.analytics,
      goalId: result.analytics.goalId,
      key: result.key,
      later: false,
      quickFormat: result.quickFormat,
      writes: result.writes,
    },
  ]);

  return NextResponse.json(
    { generationId: run.runId, status: "generating" },
    { headers: { Location: `/v1/generations/${encodeURIComponent(run.runId)}` }, status: ACCEPTED },
  );
}

export const POST = withApiErrorBoundary(createChallengeGeneration);
