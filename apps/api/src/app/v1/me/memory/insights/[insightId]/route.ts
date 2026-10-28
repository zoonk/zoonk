import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { memoryErrorCodes } from "@/lib/memory-error-codes";
import { memoryInsightPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { memoryInsightAnswerSchema } from "@zoonk/core/memory/contract";
import { respondToMemoryInsight } from "@zoonk/core/memory/insights/respond";
import { type NextRequest, NextResponse } from "next/server";

async function answerInsight(
  request: NextRequest,
  context: RouteContext<"/v1/me/memory/insights/[insightId]">,
) {
  const [body, path] = await Promise.all([
    readBody(request, memoryInsightAnswerSchema),
    readPathParams(context, memoryInsightPathParamsSchema),
  ]);

  const result = await respondToMemoryInsight({ input: body, insightId: path.insightId });

  if (result.status === "updated") {
    return NextResponse.json({ insight: result.insight });
  }

  if (result.status === "alreadyAnswered") {
    return createErrorResponse({
      code: memoryErrorCodes.insightAlreadyAnswered,
      message: "This insight was already answered",
      status: httpStatus.conflict,
    });
  }

  return result.status === "unauthorized" ? errors.unauthorized() : errors.notFound();
}

export const PATCH = withApiErrorBoundary(answerInsight);
