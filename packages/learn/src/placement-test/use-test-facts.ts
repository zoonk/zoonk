"use client";

import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";

export function useTestFacts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return {
    about: (minutes: number): string => t("About {time}", { time: formatDuration(minutes) }),
    question: ({ number, total }: { number: number; total: number }): string =>
      t("Question {number, number} of {total, number}", { number, total }),
    upToQuestions: (count: number): string =>
      t({
        description: "The most questions a test asks. It can end sooner.",
        message: "Up to {count, plural, one {# question} other {# questions}}",
        values: { count },
      }),
  };
}
