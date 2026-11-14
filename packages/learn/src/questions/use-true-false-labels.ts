"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useExtracted } from "next-intl";
import { readStatementAnswer } from "./_utils/statement-answer";

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

  function answerText({
    answer,
    format,
  }: {
    answer: string | null | undefined;
    format: string | undefined;
  }): string | null {
    if (answer === null || answer === undefined) {
      return null;
    }

    const isTrue = readStatementAnswer({ answer, format });
    return isTrue === null ? answer : answerLabel(isTrue);
  }

  return { answerLabel, answerText };
}
