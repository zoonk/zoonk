import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { focusTestQuestionsWorkflow } from "@/workflows/v2/goals/focus-test-questions-workflow";
import { requestFocusTestQuestions } from "@zoonk/core/plans/focus-test/request-questions";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

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

  const run = await start(focusTestQuestionsWorkflow, [
    {
      analytics: result.analytics,
      format: result.format,
      goalId: path.goalId,
      questionsPerSkill: result.questionsPerSkill,
      skillIds: result.skillIds,
    },
  ]);

  return NextResponse.json(
    { generationId: run.runId, status: "generating" },
    { headers: { Location: `/v1/generations/${encodeURIComponent(run.runId)}` }, status: ACCEPTED },
  );
}

export const POST = withApiErrorBoundary(createFocusTestGeneration);
