import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { withBaseMaps } from "@/lib/base-maps";
import { withApiImageUrls } from "@/lib/file-urls";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getPlayableLibraryLesson } from "@zoonk/core/lesson-player/get";
import { wordTutorSuggestions } from "@zoonk/player/tutor/suggestion-words";
import { NextResponse } from "next/server";

async function getLibraryLessonRoute(
  _request: Request,
  context: RouteContext<"/v1/library/lessons/[lessonId]">,
) {
  const parsed = await readPathParams(context, lessonPathParamsSchema);

  const result = await getPlayableLibraryLesson({ lessonId: parsed.lessonId });

  if (!result) {
    return errors.notFound();
  }

  if (result.status !== "ready") {
    return NextResponse.json(withApiImageUrls(result));
  }

  const [tutorSuggestions, steps] = await Promise.all([
    wordTutorSuggestions(result.lesson.language),
    withBaseMaps(result.lesson.steps),
  ]);

  return NextResponse.json(
    withApiImageUrls({ ...result, lesson: { ...result.lesson, steps }, tutorSuggestions }),
  );
}

export const GET = withApiErrorBoundary(getLibraryLessonRoute);
