"use client";

import { type WritingPrompt } from "@zoonk/core/exams/essays/writing-contract";
import { useExtracted } from "next-intl";

type WritingUnit = WritingPrompt["unit"];

/**
 * A writing task by the name a learner knows it: a whole answer by its task ("The 30-line
 * question"), a drill as its own short exercise, so the two never share a name on one list.
 */
export function useWritingTaskTitle() {
  const t = useExtracted();

  return ({ title, unit }: { title: string | null; unit?: WritingUnit }): string => {
    if (unit === "drill") {
      return t({
        description:
          "A few minutes of writing after a lesson, using what it just taught, such as one paragraph of an exam answer.",
        message: "Short writing exercise",
      });
    }

    return title ?? t("Writing practice");
  };
}

export function useHeaderLabel(writing: WritingPrompt): string {
  const t = useExtracted();
  const writingTitle = useWritingTaskTitle();

  return writing.unit === "drill"
    ? writingTitle({ title: null, unit: "drill" })
    : t("Written answer");
}
