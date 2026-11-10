import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { profileQuestionError } from "@/lib/profile-question-errors";
import { readBody } from "@/lib/request-input";
import { answerProfileQuestion } from "@zoonk/core/profile/questions/answer";
import { profileAnswerInputSchema } from "@zoonk/core/profile/questions/contract";
import { getLocaleFromRequest } from "@zoonk/utils/locale-request";
import { NextResponse } from "next/server";
import { z } from "zod";

async function answerQuestion(request: Request) {
  const body = profileAnswerInputSchema.safeParse(await readBody(request, z.unknown()));

  if (!body.success) {
    return errors.unprocessableEntity();
  }

  const result = await answerProfileQuestion({
    input: body.data,
    locale: getLocaleFromRequest({ acceptLanguage: request.headers.get("accept-language") }),
  });

  return result.status === "saved"
    ? NextResponse.json({ question: result.question })
    : profileQuestionError(result.status);
}
export const POST = withApiErrorBoundary(answerQuestion);
