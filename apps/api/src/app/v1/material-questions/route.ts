import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { usageDecisionError } from "@/lib/lesson-player-errors";
import { answerMaterialQuestion } from "@zoonk/core/library/sources/answer-question";
import { materialQuestionInputSchema } from "@zoonk/core/library/sources/material-question-contract";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Answers a question about the learner's own material from its pages, with the pages the answer
 * came from. Each question counts as a tutor message against the learner's allowance.
 */
async function askMaterialQuestion(request: NextRequest) {
  const parsed = await parseBody(request, materialQuestionInputSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const result = await answerMaterialQuestion(parsed.data);

  if (result.status === "answered") {
    return NextResponse.json(result.answer);
  }

  if (result.status === "notFound") {
    return errors.notFound("Material not found");
  }

  return usageDecisionError(result);
}

export const POST = withApiErrorBoundary(askMaterialQuestion);
