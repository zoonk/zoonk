import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { plusRequiredError, usageDecisionError } from "@/lib/lesson-player-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { testOutQuestionsWorkflow } from "@/workflows/v2/goals/test-out-questions-workflow";
import { requestTestOutQuestions } from "@zoonk/core/learner/test-out/request-questions";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

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

  const run = await start(testOutQuestionsWorkflow, [
    {
      analytics: result.analytics,
      questionsPerSkill: result.questionsPerSkill,
      skillIds: result.skillIds,
      ...path,
    },
  ]);

  return NextResponse.json(
    { generationId: run.runId, status: "generating" },
    { headers: { Location: `/v1/generations/${encodeURIComponent(run.runId)}` }, status: ACCEPTED },
  );
}

export const POST = withApiErrorBoundary(createTestOutGeneration);
