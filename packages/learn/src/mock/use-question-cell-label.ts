"use client";

import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { useExtracted } from "next-intl";

/** An answer sheet cell's spoken name: the question's, and whether it's marked to look at again. */
export function useQuestionCellLabel({
  flagged,
  numbered,
  question,
}: {
  flagged: boolean;
  numbered: boolean;
  question: MockQuestion;
}): string {
  const t = useExtracted();

  const label = numbered
    ? t("Question {number}", { number: String(question.number) })
    : t("Written part");

  return flagged
    ? t({
        description:
          'A cell of the mock exam\'s answer sheet the learner flagged to look at again. {question} is "Question 12" or "Written part", so use a form that agrees with both.',
        message: "{question}, flagged",
        values: { question: label },
      })
    : label;
}
