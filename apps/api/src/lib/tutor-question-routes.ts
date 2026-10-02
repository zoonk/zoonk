import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import {
  type TutorTarget,
  createLessonQuestionInputSchema,
  getLessonQuestionThreadInputSchema,
} from "@zoonk/core/lesson-questions/contract";
import { createLessonQuestion } from "@zoonk/core/lesson-questions/create";
import { getLessonQuestionThread } from "@zoonk/core/lesson-questions/get-thread";
import { type NextRequest, NextResponse } from "next/server";
import { type z } from "zod";

type QuestionsRouteContext = { params: Promise<unknown> };

/**
 * The questions routes of one kind of tutor thread (a lesson, chapter, plan or mock): the
 * learner's private thread, newest page first, and a new question. Each route says how its path
 * names what the thread is about; everything else is the same for every kind.
 */
export function tutorQuestionRoutes<TPath>({
  pathSchema,
  toTarget,
}: {
  pathSchema: z.ZodType<TPath>;
  toTarget: (path: TPath) => TutorTarget;
}) {
  async function getQuestions(request: Request, context: QuestionsRouteContext) {
    const query = parseQueryParams(
      new URL(request.url).searchParams,
      getLessonQuestionThreadInputSchema,
    );

    const path = parsePathParams({ params: await context.params, schema: pathSchema });

    if (!path.success) {
      return errors.validation(path.error);
    }

    if (!query.success) {
      return errors.validation(query.error);
    }

    const result = await getLessonQuestionThread({ ...query.data, target: toTarget(path.data) });

    if (result.status === "invalidCursor") {
      return errors.badRequest("Invalid lesson question cursor");
    }

    if (result.status !== "ready") {
      return accessError(result.status);
    }

    return NextResponse.json(result.thread);
  }

  /**
   * Persists the question before generation so a disconnect cannot lose the learner's turn and
   * retries can target the same durable resource.
   */
  async function postQuestion(request: NextRequest, context: QuestionsRouteContext) {
    const [body, path] = await Promise.all([
      parseBody(request, createLessonQuestionInputSchema),
      context.params.then((params) => parsePathParams({ params, schema: pathSchema })),
    ]);

    if (!path.success) {
      return errors.validation(path.error);
    }

    if (!body.success) {
      return errors.validation(body.error);
    }

    const result = await createLessonQuestion({ input: body.data, target: toTarget(path.data) });

    if (result.status === "invalidContext") {
      return errors.unprocessableEntity("Question context is not available here");
    }

    if (result.status === "conflict") {
      return errors.conflict("Question conflicts with an existing request or unfinished turn");
    }

    if (result.status !== "created") {
      return accessError(result.status);
    }

    return NextResponse.json(result.question, { status: 201 });
  }

  return { GET: withApiErrorBoundary(getQuestions), POST: withApiErrorBoundary(postQuestion) };
}
