"use client";

import { type ExamDocument } from "@zoonk/core/exams/document";
import { useExtracted } from "next-intl";

/** Names study the exam doesn't test, such as its strategy, wherever the plan shows it. */
export function useExtraLabel() {
  const t = useExtracted();

  return ({ document, hasNotice }: { document: ExamDocument; hasNotice: boolean }): string =>
    hasNotice
      ? t({
          description:
            'Marks study the exam doesn\'t test, such as how to manage its time. In the "notice" form the document is the exam\'s public notice (Brazil\'s "edital"); otherwise it is an official guide.',
          message:
            "{document, select, notice {Not in the official guide} other {Not in the official guide}}",
          values: { document },
        })
      : t("Optional");
}
