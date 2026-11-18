"use client";

import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { useExtracted } from "next-intl";

/** An answer sheet cell's spoken name: the question's, and whether it's marked to look at again. */
export function useQuestionCellLabel({
  flagged,
  question,
}: {
  flagged: boolean;
  question: MockQuestion;
}): string {
  const t = useExtracted();

  const label =
    question.format === "essay"
      ? t("Written part")
      : t("Question {number}", { number: String(question.number) });

  return flagged
    ? t({
        description:
          'A cell of the mock exam\'s answer sheet the learner marked to look at again. {question} is "Question 12" or "Written part", so use a form that agrees with both.',
        message: "{question}, marked for review",
        values: { question: label },
      })
    : label;
}
