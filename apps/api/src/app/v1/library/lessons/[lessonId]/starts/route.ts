import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { plusRequiredError, usageDecisionError } from "@/lib/lesson-player-errors";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { libraryLessonStartInputSchema } from "@zoonk/core/lesson-player/contract";
import { startLibraryLesson } from "@zoonk/core/lesson-player/start";
import { type NextRequest, NextResponse } from "next/server";

const CREATED = 201;

async function createLibraryLessonStart(
  request: NextRequest,
  context: RouteContext<"/v1/library/lessons/[lessonId]/starts">,
) {
  const [body, path] = await Promise.all([
    readBody(request, libraryLessonStartInputSchema),
    readPathParams(context, lessonPathParamsSchema),
  ]);

  const outcome = await startLibraryLesson({ input: body, lessonId: path.lessonId });

  if (outcome.status === "started") {
    return NextResponse.json(outcome.run, { status: CREATED });
  }

  if (outcome.status === "notFound") {
    return errors.notFound();
  }

  if (outcome.status === "plusRequired") {
    return plusRequiredError();
  }

  return usageDecisionError(outcome);
}

export const POST = withApiErrorBoundary(createLibraryLessonStart);
