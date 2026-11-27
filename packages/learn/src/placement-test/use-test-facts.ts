"use client";

import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";
import { toNextQuestion } from "./test-question";

export function useTestFacts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  const question = ({ number, total }: { number: number; total: number }): string =>
    t("Question {number, number} of {total, number}", { number, total });

  return {
    about: (minutes: number): string => t("About {time}", { time: formatDuration(minutes) }),
    nextQuestion: (test: { answered: number; total: number }): string | null => {
      const number = toNextQuestion(test);
      return number === null ? null : question({ number, total: test.total });
    },
    question,
    upToQuestions: (count: number): string =>
      t({
        description: "The most questions a test asks. It can end sooner.",
        message: "Up to {count, plural, one {# question} other {# questions}}",
        values: { count },
      }),
  };
}
