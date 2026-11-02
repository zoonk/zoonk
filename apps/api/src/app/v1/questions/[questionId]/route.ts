import { accessError } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { lessonQuestionPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readPathParams } from "@/lib/request-input";
import { getLessonQuestion } from "@zoonk/core/lesson-questions/get";
import { NextResponse } from "next/server";

async function getQuestion(_request: Request, context: RouteContext<"/v1/questions/[questionId]">) {
  const path = await readPathParams(context, lessonQuestionPathParamsSchema);

  const result = await getLessonQuestion({ questionId: path.questionId });

  if (result.status !== "ready") {
    return accessError(result.status);
  }

  return NextResponse.json(result.question);
}

export const GET = withApiErrorBoundary(getQuestion);
