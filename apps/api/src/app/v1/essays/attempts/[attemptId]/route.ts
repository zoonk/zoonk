import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { writingAttemptPathParamsSchema } from "@/lib/openapi/schemas/essays";
import { readPathParams } from "@/lib/request-input";
import { getWritingAttempt } from "@zoonk/core/exams/essays/get-writing-attempt";
import { NextResponse } from "next/server";

async function getAttempt(_request: Request, context: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await readPathParams(context, writingAttemptPathParamsSchema);
  const result = await getWritingAttempt(attemptId);
  return result.status === "ready" ? NextResponse.json(result.attempt) : examError(result);
}

export const GET = withApiErrorBoundary(getAttempt);
