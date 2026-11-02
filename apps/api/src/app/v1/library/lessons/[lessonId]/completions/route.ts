import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { completeLibraryLesson } from "@zoonk/core/lesson-player/complete";
import { libraryLessonCompletionInputSchema } from "@zoonk/core/lesson-player/completion-input-contract";
import { type NextRequest, NextResponse } from "next/server";

async function createLibraryLessonCompletion(
  request: NextRequest,
  context: RouteContext<"/v1/library/lessons/[lessonId]/completions">,
) {
  const [body, path] = await Promise.all([
    readBody(request, libraryLessonCompletionInputSchema),
    readPathParams(context, lessonPathParamsSchema),
  ]);

  const outcome = await completeLibraryLesson({ input: body, lessonId: path.lessonId });

  switch (outcome.status) {
    case "unauthorized":
      return errors.unauthorized();
    case "notFound":
      return errors.notFound();
    case "invalid":
      return errors.unprocessableEntity("Answer every screen before finishing the lesson");
    case "completed":
      return NextResponse.json(outcome.completion);
    default:
      return outcome satisfies never;
  }
}

export const POST = withApiErrorBoundary(createLibraryLessonCompletion);
