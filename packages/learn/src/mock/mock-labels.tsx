"use client";

import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { useExtracted } from "next-intl";

export function useMockTitle() {
  const t = useExtracted();

  return (mock: Pick<MockView, "number">) =>
    t("Mock exam {number}", { number: String(mock.number) });
}

/** A section's name, or a plain word when the exam doesn't name its sections. */
export function useSectionName() {
  const t = useExtracted();
  return (name: string | null) => name ?? t("Questions");
}

/** How the exam scores answers, in one sentence the learner can act on. */
export function useScoringRule() {
  const t = useExtracted();

  return (scoring: MockView["scoring"]): string => {
    if (scoring === "net") {
      return t(
        "A wrong answer cancels a right one. When you're not sure, you can leave a statement blank.",
      );
    }

    if (scoring === "irt") {
      return t(
        "Scored with item response theory, like the real exam: right answers count more when your pattern is consistent.",
      );
    }

    return t("Each right answer counts one point.");
  };
}
