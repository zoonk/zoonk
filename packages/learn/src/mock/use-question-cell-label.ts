"use client";

import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { useExtracted } from "next-intl";

/** An answer sheet cell's spoken name: the question's, and whether it's marked to look at again. */
export function useQuestionCellLabel({
  flagged,
  number,
  question,
}: {
  flagged: boolean;
  /** A written test's own count of its questions, which have no number of their own. */
  number?: number;
  question: MockQuestion;
}): string {
  const t = useExtracted();

  const label =
    question.format === "essay" && number === undefined
      ? t("Written part")
      : t("Question {number}", { number: String(number ?? question.number) });

  return flagged
    ? t({
        description:
          'A cell of the mock exam\'s answer sheet the learner flagged to look at again. {question} is "Question 12" or "Written part", so use a form that agrees with both.',
        message: "{question}, flagged",
        values: { question: label },
      })
    : label;
}
