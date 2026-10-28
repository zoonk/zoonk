import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { earlierQuestionsQuerySchema } from "@/lib/openapi/schemas/lesson-questions";
import { readQueryParams } from "@/lib/request-input";
import { listEarlierQuestions } from "@zoonk/core/lesson-questions/earlier";
import { type NextRequest, NextResponse } from "next/server";

async function listQuestions(request: NextRequest) {
  const query = readQueryParams(request, earlierQuestionsQuerySchema);

  const result = await listEarlierQuestions(query);

  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "invalidCursor") {
    return errors.badRequest("Invalid earlier question cursor");
  }

  return NextResponse.json({ nextCursor: result.nextCursor, questions: result.questions });
}

export const GET = withApiErrorBoundary(listQuestions);
