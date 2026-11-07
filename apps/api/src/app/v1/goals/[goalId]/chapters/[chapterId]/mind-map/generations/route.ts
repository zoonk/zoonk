import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { plusRequiredError, usageDecisionError } from "@/lib/lesson-player-errors";
import { goalChapterPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { toChapterMindMapInput } from "@/workflows/mind-maps/chapter-mind-map-input";
import { chapterMindMapWorkflow } from "@/workflows/mind-maps/chapter-mind-map-workflow";
import { requestChapterMindMap } from "@zoonk/core/mind-maps/request";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

const ACCEPTED = 202;

function onItsWay({
  generationId,
  status,
}: {
  generationId: string | null;
  status: "drawing" | "writingLessons";
}) {
  return NextResponse.json(
    { generationId, status },
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
    return errors.unprocessableEntity("This chapter has no mind map");
  }

  if (result.status === "plusRequired") {
    return plusRequiredError();
  }

  if (result.status === "refused") {
    return usageDecisionError(result.decision);
  }

  if (result.status === "ready") {
    return NextResponse.json({ generationId: null, status: "ready" });
  }

  if (result.status !== "start") {
    return onItsWay(result);
  }

  const run = await start(chapterMindMapWorkflow, [
    toChapterMindMapInput({ chapterId: path.chapterId, request: result }),
  ]);

  return onItsWay({
    generationId: run.runId,
    status: result.lessonIds.length > 0 ? "writingLessons" : "drawing",
  });
}

export const POST = withApiErrorBoundary(createMindMapGeneration);
