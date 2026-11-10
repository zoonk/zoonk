"use server";

import { answerProfileQuestion } from "@zoonk/core/profile/questions/answer";
import { profileAnswerInputSchema } from "@zoonk/core/profile/questions/contract";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";

export async function answerProfileQuestionAction(
  input: unknown,
  language: string,
): Promise<boolean> {
  const parsed = profileAnswerInputSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const result = await answerProfileQuestion({
    input: parsed.data,
    locale: getSupportedLocaleFromLanguage(language),
  });

  return result.status === "saved";
}
