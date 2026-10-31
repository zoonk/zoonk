"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useExtracted } from "next-intl";

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

  function answerText(answer: string | null | undefined): string | null {
    if (answer === "true" || answer === "false") {
      return answerLabel(answer === "true");
    }

    return answer ?? null;
  }

  return { answerLabel, answerText };
}
