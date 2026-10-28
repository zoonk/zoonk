import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { chapterMindMapWorkflow } from "@/workflows/v2/mind-maps/chapter-mind-map-workflow";
import { requestChapterMindMap } from "@zoonk/core/mind-maps/request";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

const ACCEPTED = 202;

function generating(generationId: string | null) {
  return NextResponse.json(
    { generationId, status: "generating" },
    {
      headers: generationId
        ? { Location: `/v1/generations/${encodeURIComponent(generationId)}` }
        : undefined,
      status: ACCEPTED,
    },
  );
}

async function createMindMapGeneration(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]/mind-map/generations">,
) {
  const path = await readPathParams(context, goalChapterPathParamsSchema);

  const result = await requestChapterMindMap(path);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "unavailable") {
    return errors.unprocessableEntity(
      "Mind maps are for chapters the learner finished, once their lessons are written",
    );
  }

  if (result.status === "refused") {
    return usageDecisionError(result.decision);
  }

  if (result.status === "ready") {
    return NextResponse.json({ generationId: null, status: "ready" });
  }

  if (result.status === "generating") {
    return generating(result.generationId);
  }

  const run = await start(chapterMindMapWorkflow, [
    { analytics: result.analytics, chapterId: path.chapterId },
  ]);

  return generating(run.runId);
}

export const POST = withApiErrorBoundary(createMindMapGeneration);
