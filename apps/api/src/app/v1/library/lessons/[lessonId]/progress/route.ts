import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { hasStartedLesson } from "@zoonk/core/lesson-player/progress";
import { NextResponse } from "next/server";

async function getLibraryLessonProgress(
  _request: Request,
  context: RouteContext<"/v1/library/lessons/[lessonId]/progress">,
) {
  const path = await readPathParams(context, lessonPathParamsSchema);
  const started = await hasStartedLesson({ lessonId: path.lessonId });

  return NextResponse.json({ started });
}

export const GET = withApiErrorBoundary(getLibraryLessonProgress);
