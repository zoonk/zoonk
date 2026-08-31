import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonQuestionAccessError } from "@/lib/lesson-question-errors";
import { lessonQuestionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { getLessonQuestion } from "@zoonk/core/lesson-questions/get";
import { NextResponse } from "next/server";

async function getQuestion(_request: Request, context: RouteContext<"/v1/questions/[questionId]">) {
  const path = parsePathParams({
    params: await context.params,
    schema: lessonQuestionPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  const result = await getLessonQuestion({ questionId: path.data.questionId });

  if (result.status !== "ready") {
    return lessonQuestionAccessError(result.status);
  }

  return NextResponse.json(result.question);
}

export const GET = withApiErrorBoundary(getQuestion);
