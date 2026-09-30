import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { testOutQuestionsWorkflow } from "@/workflows/v2/goals/test-out-questions-workflow";
import { requestTestOutQuestions } from "@zoonk/core/learner/test-out/request-questions";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

const ACCEPTED = 202;

/**
 * Gets a chapter's test-out ready when the learner asks for it: `ready` when it has a question for
 * every skill it samples, otherwise a run writes the missing ones (a second request joins it).
 * Each start counts as small AI help.
 */
async function createTestOutGeneration(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]/test-out/generations">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: goalChapterPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await requestTestOutQuestions(path.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "refused") {
    return usageDecisionError(result.decision);
  }

  if (result.status === "ready") {
    return NextResponse.json({ generationId: null, status: "ready" });
  }

  const run = await start(testOutQuestionsWorkflow, [
    { analytics: result.analytics, skillIds: result.skillIds, ...path.data },
  ]);

  return NextResponse.json(
    { generationId: run.runId, status: "generating" },
    { headers: { Location: `/v1/generations/${encodeURIComponent(run.runId)}` }, status: ACCEPTED },
  );
}

export const POST = withApiErrorBoundary(createTestOutGeneration);
