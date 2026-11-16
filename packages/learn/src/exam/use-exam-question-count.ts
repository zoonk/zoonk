"use client";

import { useExtracted } from "next-intl";

/**
 * An exam's items take their own messages: Portuguese counts them as "questões", a lesson's
 * questions as "perguntas".
 */
export function useExamQuestionCount() {
  const t = useExtracted();

  return (count: number) =>
    t({
      description: "The number of questions in an exam or a mock exam.",
      id: "examQuestionCount",
      message: "{count, plural, one {# question} other {# questions}}",
      values: { count },
    });
}

export function useExamQuestionsLabel() {
  const t = useExtracted();

  return t({
    description: "Labels the number of questions in an exam or a mock exam.",
    id: "examQuestionsLabel",
    message: "Questions",
  });
}
