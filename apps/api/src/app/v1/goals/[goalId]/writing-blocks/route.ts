import { withApiErrorBoundary } from "@/lib/api-handler";
import { examError } from "@/lib/exam-errors";
import { goalPathParamsSchema } from "@/lib/openapi/schemas/paths";
import { readBody, readPathParams } from "@/lib/request-input";
import { createWritingBlock } from "@zoonk/core/exams/essays/create-writing-block";
import { writingBlockInputSchema } from "@zoonk/core/exams/essays/writing-contract";
import { NextResponse } from "next/server";

async function postWritingBlock(
  request: Request,
  context: { params: Promise<{ goalId: string }> },
) {
  const [input, path] = await Promise.all([
    readBody(request, writingBlockInputSchema),
    readPathParams(context, goalPathParamsSchema),
  ]);

  const result = await createWritingBlock({ ...input, goalId: path.goalId });

  return result.status === "ready"
    ? NextResponse.json({ blockId: result.blockId })
    : examError(result);
}

export const POST = withApiErrorBoundary(postWritingBlock);
