import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { chapterMindMapWorkflow } from "@/workflows/v2/mind-maps/chapter-mind-map-workflow";
import { requestChapterMindMap } from "@zoonk/core/mind-maps/request";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

const ACCEPTED = 202;

/** A run is making the map: 202 with its id, and its status URL once it has one. */
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

/**
 * Makes a chapter's mind map when the learner asks for it: `ready` when it exists, otherwise a run
 * writes and draws it (a second request, from any learner of the chapter, joins it). A new map
 * counts toward the learner's mind map limits.
 */
async function createMindMapGeneration(
  _request: Request,
  context: RouteContext<"/v1/goals/[goalId]/chapters/[chapterId]/mind-map/generations">,
) {
  const path = parsePathParams({
    params: await context.params,
    schema: goalChapterPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await requestChapterMindMap(path.data);

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
    { analytics: result.analytics, chapterId: path.data.chapterId },
  ]);

  return generating(run.runId);
}

export const POST = withApiErrorBoundary(createMindMapGeneration);
