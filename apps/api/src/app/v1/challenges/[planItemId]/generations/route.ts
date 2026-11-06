import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { plusRequiredError, usageDecisionError } from "@/lib/lesson-player-errors";
import { challengePathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { startOnce } from "@/workflows/_shared/run-token";
import {
  challengeQuestionsWorkflow,
  getChallengeQuestionsToken,
} from "@/workflows/goals/challenge-questions-workflow";
import { requestChallengeQuestions } from "@zoonk/core/checkpoints/challenge-questions";
import { NextResponse } from "next/server";

const ACCEPTED = 202;

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

  const generationId = await startOnce(
    challengeQuestionsWorkflow,
    [
      {
        analytics: result.analytics,
        goalId: result.analytics.goalId,
        key: result.key,
        later: false,
        quickFormat: result.quickFormat,
        writes: result.writes,
      },
    ],
    getChallengeQuestionsToken(result),
  );

  return NextResponse.json(
    { generationId, status: "generating" },
    {
      headers: { Location: `/v1/generations/${encodeURIComponent(generationId)}` },
      status: ACCEPTED,
    },
  );
}

export const POST = withApiErrorBoundary(createChallengeGeneration);
