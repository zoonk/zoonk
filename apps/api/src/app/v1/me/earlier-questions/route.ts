import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { earlierQuestionsQuerySchema } from "@/lib/openapi/schemas/lesson-questions";
import { parseQueryParams } from "@/lib/query-params";
import { listEarlierQuestions } from "@zoonk/core/lesson-questions/earlier";
import { type NextRequest, NextResponse } from "next/server";

/** A page of the learner's questions from an earlier version of their courses, as history. */
async function listQuestions(request: NextRequest) {
  const query = parseQueryParams(request.nextUrl.searchParams, earlierQuestionsQuerySchema);

  if (!query.success) {
    return errors.validation(query.error);
  }

  const result = await listEarlierQuestions(query.data);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "invalidCursor") {
    return errors.badRequest("Invalid earlier question cursor");
  }

  return NextResponse.json({ nextCursor: result.nextCursor, questions: result.questions });
}

export const GET = withApiErrorBoundary(listQuestions);
