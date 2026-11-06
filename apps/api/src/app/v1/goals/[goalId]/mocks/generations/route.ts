import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { startOnce } from "@/workflows/_shared/run-token";
import {
  getMockQuestionsToken,
  mockQuestionsWorkflow,
} from "@/workflows/goals/mock-questions-workflow";
import { mockQuestionsInputSchema } from "@zoonk/core/exams/mocks/contract";
import { requestMockQuestions } from "@zoonk/core/exams/mocks/request-questions";
import { type NextRequest, NextResponse } from "next/server";

const ACCEPTED = 202;

async function createMockQuestions(
  request: NextRequest,
  context: RouteContext<"/v1/goals/[goalId]/mocks/generations">,
) {
  const [body, path] = await Promise.all([
    readBody(request, mockQuestionsInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await requestMockQuestions({ goalId: path.goalId, input: body });

  if (result.status === "refused") {
    return usageDecisionError(result.decision);
  }

  if (result.status === "ready" || result.status === "preparing") {
    return NextResponse.json({ generationId: null, status: result.status });
  }

  if (result.status !== "start") {
    return examError(result);
  }

  const generationId = await startOnce(
    mockQuestionsWorkflow,
    [
      {
        analytics: result.analytics,
        goalId: path.goalId,
        listening: result.listening,
        quickFormat: result.quickFormat,
        writes: result.writes,
      },
    ],
    getMockQuestionsToken(path.goalId),
  );

  return NextResponse.json(
    { generationId, status: "generating" },
    {
      headers: { Location: `/v1/generations/${encodeURIComponent(generationId)}` },
      status: ACCEPTED,
    },
  );
}

export const POST = withApiErrorBoundary(createMockQuestions);
