import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { completeLibraryLesson } from "@zoonk/core/lesson-player/complete";
import { libraryLessonCompletionInputSchema } from "@zoonk/core/lesson-player/contract";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Finishes a run once every screen that takes an answer was answered (or "I know this" got every
 * check right). Repeating it returns the same result without counting twice.
 */
async function createLibraryLessonCompletion(
  request: NextRequest,
  context: RouteContext<"/v1/library/lessons/[lessonId]/completions">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, libraryLessonCompletionInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: lessonPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const outcome = await completeLibraryLesson({ input: body.data, lessonId: path.data.lessonId });

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
