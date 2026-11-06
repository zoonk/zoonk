import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { startOnce } from "@/workflows/_shared/run-token";
import {
  focusTestQuestionsWorkflow,
  getFocusTestQuestionsToken,
} from "@/workflows/goals/focus-test-questions-workflow";
import { requestFocusTestQuestions } from "@zoonk/core/plans/focus-test/request-questions";
import { NextResponse } from "next/server";

const ACCEPTED = 202;

async function createFocusTestGeneration(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/plan/focus-test/generations">,
) {
  const path = await readPathParams(context, goalPathParamsSchema);

  const result = await requestFocusTestQuestions(path);

  if (result.status === "unauthorized" || result.status === "notFound") {
    return accessError(result.status);
  }

  if (result.status === "unavailable") {
    return errors.notFound("This plan has no areas to choose a focus between");
  }

  if (result.status === "refused") {
    return usageDecisionError(result.decision);
  }

  if (result.status === "ready") {
    return NextResponse.json({ generationId: null, status: "ready" });
  }

  const generationId = await startOnce(
    focusTestQuestionsWorkflow,
    [
      {
        analytics: result.analytics,
        format: result.format,
        goalId: path.goalId,
        questionsPerSkill: result.questionsPerSkill,
        skillIds: result.skillIds,
      },
    ],
    getFocusTestQuestionsToken(path.goalId),
  );

  return NextResponse.json(
    { generationId, status: "generating" },
    {
      headers: { Location: `/v1/generations/${encodeURIComponent(generationId)}` },
      status: ACCEPTED,
    },
  );
}

export const POST = withApiErrorBoundary(createFocusTestGeneration);
