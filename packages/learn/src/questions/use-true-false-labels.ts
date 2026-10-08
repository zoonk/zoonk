"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useExtracted } from "next-intl";

/**
 * The words a true-or-false statement is answered with, from the goal's exam: right or wrong where a
 * wrong answer cancels a right one (Cebraspe's Certo or Errado), true or false everywhere else.
 * Every screen with statements labels them here, so buttons, feedback and reviews always agree.
 */
export function useTrueFalseLabels(labels: TrueFalseLabels) {
  const t = useExtracted();

  function answerLabel(isTrue: boolean): string {
    if (labels === "rightWrong") {
      return t("{judgment, select, right {Right} other {Wrong}}", {
        judgment: isTrue ? "right" : "wrong",
      });
    }

    return isTrue ? t("True") : t("False");
  }

  /** A saved answer to a statement ("true" or "false") in these words; other answers as saved. */
  function answerText(answer: string | null | undefined): string | null {
    if (answer === "true" || answer === "false") {
      return answerLabel(answer === "true");
    }

    return answer ?? null;
  }

  return { answerLabel, answerText };
}
