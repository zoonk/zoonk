import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonSetAsideError, usageDecisionError } from "@/lib/lesson-player-errors";
import { startLessonWriting } from "@/lib/lesson-writing";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { NextResponse } from "next/server";

const ACCEPTED = 202;

function acceptedGeneration(generationId: string) {
  return NextResponse.json(
    { generationId, status: "generating" },
    {
      headers: { Location: `/v1/generations/${encodeURIComponent(generationId)}` },
      status: ACCEPTED,
    },
  );
}

/**
 * Gets a Library lesson written now. A lesson already written answers `ready`; one being written
 * answers with the run writing it, so a second request follows it from its stream's start instead
 * of paying twice (a run that stopped is replaced); otherwise a run starts, at the priority tier
 * since the learner is waiting on it. Asking counts as the lesson start it leads to, planned
 * lessons included. A lesson set aside after its last held-back draft answers 409.
 */
async function createLessonGeneration(
  _request: Request,
  context: RouteContext<"/v1/library/lessons/[lessonId]/generations">,
) {
  const path = parsePathParams({ params: await context.params, schema: lessonPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await startLessonWriting(path.data.lessonId);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound") {
    return errors.notFound();
  }

  if (result.status === "refused") {
    return usageDecisionError(result.decision);
  }

  if (result.status === "setAside") {
    return lessonSetAsideError();
  }

  if (result.status === "ready") {
    return NextResponse.json({ generationId: null, status: "ready" });
  }

  return acceptedGeneration(result.generationId);
}

export const POST = withApiErrorBoundary(createLessonGeneration);
