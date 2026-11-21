"use client";

import { type MockQuestion } from "@zoonk/core/exams/mocks/view-contract";
import { useExtracted } from "next-intl";

/** An answer sheet cell's spoken name: the question's, and whether the learner marked it "Not sure". */
export function useQuestionCellLabel({
  numbered,
  question,
  unsure,
}: {
  numbered: boolean;
  question: MockQuestion;
  unsure: boolean;
}): string {
  const t = useExtracted();

  const label = numbered
    ? t("Question {number}", { number: String(question.number) })
    : t("Written part");

  return unsure
    ? t({
        description:
          'A cell of the mock exam\'s answer sheet the learner marked with the "Not sure" button. {question} is "Question 12" or "Written part", so use a form that agrees with both.',
        message: "{question}, not sure",
        values: { question: label },
      })
    : label;
}
