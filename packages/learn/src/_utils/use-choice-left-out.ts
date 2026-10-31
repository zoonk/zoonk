"use client";

import { type ExamChoiceView } from "@zoonk/core/exams/choices/contract";
import { useExtracted } from "next-intl";

export function useChoiceLeftOutLine() {
  const t = useExtracted();

  return ({
    leftOut: { examPoints, examQuestions, name, points, questions },
  }: ExamChoiceView): string => {
    if (points !== null && examPoints !== null) {
      return t({
        description:
          "{name} is a part of the exam, such as a specialty's own test or a foreign language, that the learner's plan skips until they pick an option. {count} and {total} are points of the exam's score.",
        message:
          "Until you pick, your plan and mocks leave out {name}: {count, number} of the exam's {total, number} points.",
        values: { count: points, name, total: examPoints },
      });
    }

    if (questions !== null && examQuestions !== null) {
      return t({
        description:
          "{name} is a part of the exam, such as a specialty's own test or a foreign language, that the learner's plan skips until they pick an option.",
        message:
          "Until you pick, your plan and mocks leave out {name}: {count, number} of the exam's {total, number} questions.",
        values: { count: questions, name, total: examQuestions },
      });
    }

    if (questions !== null) {
      return t({
        description:
          "{name} is a part of the exam, such as a specialty's own test or a foreign language, that the learner's plan skips until they pick an option.",
        message:
          "Until you pick, your plan and mocks leave out {name}: {count, plural, one {# question} other {# questions}}.",
        values: { count: questions, name },
      });
    }

    return t({
      description:
        "{name} is a part of the exam, such as a specialty's own test or a foreign language, that the learner's plan skips until they pick an option.",
      message: "Until you pick, your plan and mocks leave out {name}.",
      values: { name },
    });
  };
}
