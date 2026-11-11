"use client";

import {
  type FocusRow,
  type FocusTestSubject,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";

export function useSubjectStateText() {
  const t = useExtracted();

  return (subject: Pick<FocusTestSubject, "asked" | "part" | "right" | "state">): string => {
    if (subject.state === "answered") {
      return t(
        "{correct, plural, =0 {# of {total, number} right} one {# of {total, number} right} other {# of {total, number} right}}",
        { correct: subject.right, total: subject.asked },
      );
    }

    if (subject.state === "notAsked") {
      return t({
        description: "A subject the Focus test hasn't asked a question about yet.",
        message: "Not asked yet",
      });
    }

    return t({
      description:
        "A part of the exam the Focus test's quick questions can't check, such as the essay.",
      message:
        "{part, select, written {Writing: not checked here} listening {Listening: not checked here} speaking {Speaking: not checked here} other {Practical part: not checked here}}",
      values: { part: subject.part ?? "other" },
    });
  };
}

export function useFocusReasonText() {
  const t = useExtracted();

  return (row: Pick<FocusRow, "part" | "reason">): string => {
    switch (row.reason) {
      case "answers":
        return t("Your answers suggest reviewing this subject.");
      case "minimumScore":
        return t("This part has a minimum score.");
      case "notChecked":
        return t({
          description:
            "Why the plan gives a part of the exam more time: it weighs a lot in the exam's score, and the Focus test can't ask about it.",
          message:
            "{part, select, written {Writing counts heavily; it isn't checked here.} listening {Listening counts heavily; it isn't checked here.} speaking {Speaking counts heavily; it isn't checked here.} other {This part counts heavily; it isn't checked here.}}",
          values: { part: row.part ?? "other" },
        });
      case "notAsked":
        return t("This subject counts heavily. Its starting point hasn't been checked yet.");
      case "weight":
        return t("This subject counts heavily.");
      default:
        return row.reason satisfies never;
    }
  };
}

/** A sitting's size as its facts: "Up to 15 questions" and "About 15 min". */
export function useSittingFacts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return {
    about: (minutes: number): string => t("About {time}", { time: formatDuration(minutes) }),
    upTo: (questions: number): string =>
      t("{count, plural, one {Up to # question} other {Up to # questions}}", { count: questions }),
  };
}
