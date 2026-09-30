import { createErrorResponse, errors, httpStatus } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { memoryErrorCodes } from "@/lib/memory-error-codes";
import { memoryInsightPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { parsePathParams } from "@/lib/path-params";
import { memoryInsightAnswerSchema } from "@zoonk/core/memory/contract";
import { respondToMemoryInsight } from "@zoonk/core/memory/insights/respond";
import { type NextRequest, NextResponse } from "next/server";

/** Accepts or dismisses an insight; accepting applies what it suggests. */
async function answerInsight(
  request: NextRequest,
  context: RouteContext<"/v1/me/memory/insights/[insightId]">,
) {
  const [body, path] = await Promise.all([
    parseBody(request, memoryInsightAnswerSchema),
    context.params.then((params) =>
      parsePathParams({ params, schema: memoryInsightPathParamsSchema }),
    ),
  ]);

  if (!path.success) {
    return errors.validation(path.error);
  }

  if (!body.success) {
    return errors.validation(body.error);
  }

  const result = await respondToMemoryInsight({ input: body.data, insightId: path.data.insightId });

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
