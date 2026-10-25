import { accessError, errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonQuestionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { parseQueryParams } from "@/lib/query-params";
import { lessonQuestionReadInputSchema } from "@zoonk/core/lesson-questions/contract";
import { getLessonQuestion } from "@zoonk/core/lesson-questions/get";
import { NextResponse } from "next/server";

async function getQuestion(request: Request, context: RouteContext<"/v1/questions/[questionId]">) {
  const query = parseQueryParams(new URL(request.url).searchParams, lessonQuestionReadInputSchema);

  const path = parsePathParams({
    params: await context.params,
    schema: lessonQuestionPathParamsSchema,
  });

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await getLessonQuestion({ ...query.data, questionId: path.data.questionId });

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  return NextResponse.json(result.question);
}

export const GET = withApiErrorBoundary(getQuestion);
