import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { libraryLessonStartInputSchema } from "@zoonk/core/lesson-player/contract";
import { startLibraryLesson } from "@zoonk/core/lesson-player/start";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

/**
 * Starts (or resumes) a run of a Library lesson for the learner or guest in the session. The
 * lesson counts toward the allowance once; a refused start says whether to wait, sign up or
 * upgrade.
 */
async function createLibraryLessonStart(
  request: NextRequest,
  context: RouteContext<"/v1/library/lessons/[lessonId]/starts">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, libraryLessonStartInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: lessonPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const outcome = await startLibraryLesson({ input: body.data, lessonId: path.data.lessonId });

  if (outcome.status === "started") {
    return NextResponse.json(outcome.run, { status: CREATED });
  }

  if (outcome.status === "notFound") {
    return errors.notFound();
  }

  return usageDecisionError(outcome);
}

export const POST = withApiErrorBoundary(createLibraryLessonStart);
