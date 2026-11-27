"use client";

import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";

export function useTestFacts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return {
    about: (minutes: number): string => t("About {time}", { time: formatDuration(minutes) }),
    aboutLeft: (minutes: number): string =>
      t("About {time} left", { time: formatDuration(minutes) }),
    nextTime: ({ part, parts, question }: { part: number; parts: number; question: number }) =>
      t({
        description:
          "Where a learner who stopped a test picks it up: the part of the test and the question in it.",
        message: "Next time: part {part, number} of {parts, number}, question {number, number}",
        values: { number: question, part, parts },
      }),
    part: ({ part, parts }: { part: number; parts: number }): string =>
      t({
        description: "Where the learner is in a test split into parts, such as “Part 3 of 14”.",
        message: "Part {part, number} of {parts, number}",
        values: { part, parts },
      }),
    partsAnyDay: (count: number): string =>
      t({
        description:
          "How many parts the long test has. The learner can take each part on a different day.",
        message:
          "{count, plural, one {# part, any day you like} other {# parts, any day you like}}",
        values: { count },
      }),
    partsLeft: (count: number): string =>
      t({
        description: "How many parts of a test the learner still has to take.",
        message: "{count, plural, one {# part left} other {# parts left}}",
        values: { count },
      }),
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
