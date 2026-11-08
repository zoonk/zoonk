import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { updateLessonClock } from "@zoonk/core/lesson-player/clock";
import { lessonClockInputSchema } from "@zoonk/core/lesson-player/clock-contract";
import { type NextRequest, NextResponse } from "next/server";

async function updateLibraryLessonClock(
  request: NextRequest,
  context: RouteContext<"/v1/library/lessons/[lessonId]/clock">,
) {
  const [input, path] = await Promise.all([
    readBody(request, lessonClockInputSchema),
    readPathParams(context, lessonPathParamsSchema),
  ]);

  const outcome = await updateLessonClock({ input, lessonId: path.lessonId });

  if (outcome.status === "unauthorized" || outcome.status === "notFound") {
    return accessError(outcome.status);
  }

  return NextResponse.json(outcome);
}

export const POST = withApiErrorBoundary(updateLibraryLessonClock);
