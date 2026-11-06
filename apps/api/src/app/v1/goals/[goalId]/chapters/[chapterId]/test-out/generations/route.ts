import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { plusRequiredError, usageDecisionError } from "@/lib/lesson-player-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { startOnce } from "@/workflows/_shared/run-token";
import {
  getTestOutQuestionsToken,
  testOutQuestionsWorkflow,
} from "@/workflows/goals/test-out-questions-workflow";
import { requestTestOutQuestions } from "@zoonk/core/learner/test-out/request-questions";
import { NextResponse } from "next/server";

const ACCEPTED = 202;

async function createTestOutGeneration(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]/test-out/generations">,
) {
  const path = await readPathParams(context, goalChapterPathParamsSchema);

  const result = await requestTestOutQuestions(path);

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

  if (result.status === "nothingToSkip") {
    return NextResponse.json(result);
  }

  if (result.status === "ready") {
    return NextResponse.json({ generationId: null, status: "ready" });
  }

  const generationId = await startOnce(
    testOutQuestionsWorkflow,
    [
      {
        analytics: result.analytics,
        questionsPerSkill: result.questionsPerSkill,
        skillIds: result.skillIds,
        ...path,
      },
    ],
    getTestOutQuestionsToken(path),
  );

  return NextResponse.json(
    { generationId, status: "generating" },
    {
      headers: { Location: `/v1/generations/${encodeURIComponent(generationId)}` },
      status: ACCEPTED,
    },
  );
}

export const POST = withApiErrorBoundary(createTestOutGeneration);
