import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { lessonQuestionAccessError } from "@/lib/lesson-question-errors";
import { lessonPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import {
  createLessonQuestionInputSchema,
  getLessonQuestionThreadInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { createLessonQuestion } from "@zoonk/core/lesson-questions/create";
import { getLessonQuestionThread } from "@zoonk/core/lesson-questions/get-thread";
import { type NextRequest, NextResponse } from "next/server";

/** Returns the current learner's private, lesson-scoped question thread. */
async function getLessonQuestions(
  request: Request,
  context: RouteContext<"/v1/lessons/[lessonId]/questions">,
) {
  const query = parseQueryParams(
    new URL(request.url).searchParams,
    getLessonQuestionThreadInputSchema,
  );

  const path = parsePathParams({ params: await context.params, schema: lessonPathParamsSchema });

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getLessonQuestionThread({
    cursor: query.data.cursor,
    lessonId: path.data.lessonId,
  });

  if (result.status === "invalidCursor") {
    return errors.badRequest("Invalid lesson question cursor");
  }

  if (result.status !== "ready") {
    return lessonQuestionAccessError(result.status);
  }

  return NextResponse.json(result.thread);
}

/**
 * Persists the question before generation so a disconnect cannot lose the
 * learner's turn and retries can target the same durable resource.
 */
async function postLessonQuestion(
  request: NextRequest,
  context: RouteContext<"/v1/lessons/[lessonId]/questions">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, createLessonQuestionInputSchema),
    context.params.then((params) => parsePathParams({ params, schema: lessonPathParamsSchema })),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await createLessonQuestion({ input: body.data, lessonId: path.data.lessonId });

  if (result.status === "invalidContext") {
    return errors.unprocessableEntity("Question context is not available for this lesson");
  }

  if (result.status === "conflict") {
    return errors.conflict("Question conflicts with an existing request or unfinished turn");
  }

  if (result.status !== "created") {
    return lessonQuestionAccessError(result.status);
  }

  return NextResponse.json(result.question, { status: 201 });
}

export const GET = withApiErrorBoundary(getLessonQuestions);
export const POST = withApiErrorBoundary(postLessonQuestion);
