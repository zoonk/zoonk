import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { examError } from "@/lib/exam-errors";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { mockQuestionsWorkflow } from "@/workflows/v2/goals/mock-questions-workflow";
import { mockQuestionsInputSchema } from "@zoonk/core/exams/mocks/contract";
import { requestMockQuestions } from "@zoonk/core/exams/mocks/request-questions";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

const ACCEPTED = 202;

/**
 * Gets a mock's questions ready when the learner starts it: `ready` when the shared bank holds
 * them, `preparing` while the goal's skill map is drawn, otherwise a run writes the missing ones
 * (a second request joins it). Each start counts as small AI help.
 */
async function createMockQuestions(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/mocks/generations">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, mockQuestionsInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: goalPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await requestMockQuestions({ goalId: path.data.goalId, input: body.data });

  if (result.status === "refused") {
    return usageDecisionError(result.decision);
  }

  if (result.status === "ready" || result.status === "preparing") {
    return NextResponse.json({ generationId: null, status: result.status });
  }

  if (!("skillIds" in result)) {
    return examError(result);
  }

  const run = await start(mockQuestionsWorkflow, [
    {
      analytics: result.analytics,
      format: result.format,
      goalId: path.data.goalId,
      questionsPerSkill: result.questionsPerSkill,
      skillIds: result.skillIds,
    },
  ]);

  return NextResponse.json(
    { generationId: run.runId, status: "generating" },
    { headers: { Location: `/v1/generations/${encodeURIComponent(run.runId)}` }, status: ACCEPTED },
  );
}

export const POST = withApiErrorBoundary(createMockQuestions);
