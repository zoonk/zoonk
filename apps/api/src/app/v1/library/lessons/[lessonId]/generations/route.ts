import { acceptedGeneration } from "@/lib/accepted-generation";
import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import {
  lessonSetAsideError,
  plusRequiredError,
  usageDecisionError,
} from "@/lib/lesson-player-errors";
import { startLessonWriting } from "@/lib/lesson-writing";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { NextResponse } from "next/server";

async function createLessonGeneration(
  _request: Request,
  context: RouteContext<"/v1/library/lessons/[lessonId]/generations">,
) {
  const path = await readPathParams(context, lessonPathParamsSchema);

  const result = await startLessonWriting(path.lessonId);

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

  if (result.status === "plusRequired") {
    return plusRequiredError();
  }

  if (result.status === "ready") {
    return NextResponse.json({ generationId: null, status: "ready" });
  }

  return acceptedGeneration(result.generationId);
}

export const POST = withApiErrorBoundary(createLessonGeneration);
