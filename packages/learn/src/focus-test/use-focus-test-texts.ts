"use client";

import {
  type FocusRow,
  type FocusTestSubject,
  type FocusTestSummary,
} from "@zoonk/core/learner/placement/focus-test-contract";
import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";

/** What learners call the subject, when the exam's notice names it at length. */
export function getSubjectName(subject: { name: string; shortName: string | null }): string {
  return subject.shortName ?? subject.name;
}

export function useSubjectStateText() {
  const t = useExtracted();

  return (
    subject: Pick<FocusTestSubject, "asked" | "dontKnow" | "part" | "right" | "state">,
  ): string => {
    if (subject.state === "answered" && subject.asked === subject.dontKnow) {
      return t({
        description:
          "A short fact beside a subject in a list: every answer the learner gave on it was “I don't know yet”. It is not a grade.",
        message: "Not known yet",
      });
    }

    if (subject.state === "answered") {
      return t({
        description:
          "A short fact: how many of the questions asked the learner got right, such as “1 of 2 right”. Word every form the same way, so it reads well for 0, 1 and more right answers.",
        message:
          "{correct, plural, =0 {# of {total, number} right} one {# of {total, number} right} other {# of {total, number} right}}",
        values: { correct: subject.right, total: subject.asked - subject.dontKnow },
      });
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

/** The row's title already names the subject, so no reason says it again. */
export function useFocusReasonText() {
  const t = useExtracted();

  return (reason: FocusRow["reason"]): string => {
    switch (reason) {
      case "answers":
        return t({
          description:
            "A reason beside a suggested subject. Say “this subject” with the same words as in “This subject counts heavily.”",
          message: "Your answers suggest giving this subject more time.",
        });
      case "minimumScore":
        return t("This part has a minimum score.");
      case "notChecked":
        return t({
          description:
            "Why the plan gives a part of the exam more time: it weighs a lot in the exam's score, and the Focus test can't ask about it.",
          message: "This part counts heavily; it isn't checked here.",
        });
      case "notAsked":
        return t("This subject counts heavily. Its starting point hasn't been checked yet.");
      case "weight":
        return t("This subject counts heavily.");
      default:
        return reason satisfies never;
    }
  };
}

export function useSessionQuestionsNote(): string {
  const t = useExtracted();

  return t({
    description:
      "“Test questions” are the Focus test's questions. Use the same words for them as in “Pause test questions”.",
    message: "Your next sessions ask a few more test questions.",
  });
}

export function useSittingFacts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return {
    about: (minutes: number): string => t("About {time}", { time: formatDuration(minutes) }),
    upTo: (questions: number): string =>
      t("{count, plural, one {Up to # question} other {Up to # questions}}", { count: questions }),
  };
}

export function useFocusTestStateFacts() {
  const t = useExtracted();
  const { about } = useSittingFacts();

  return ({ offer, state, subjects }: FocusTestSummary): string[] => {
    if (state === "notStarted") {
      return [t("Not started"), ...(offer ? [about(offer.minutes)] : [])];
    }

    if (state === "sitting" && offer) {
      return [
        t("Continue"),
        t("{count, plural, one {# question left} other {# questions left}}", {
          count: offer.questions,
        }),
      ];
    }

    const result = subjects
      ? t(
          "Questions on {asked, number} of {total, plural, one {# subject} other {# subjects}}",
          subjects,
        )
      : t("Your answers are in your plan");

    return [
      result,
      ...(offer
        ? [
            t("{count, plural, one {Up to # more question} other {Up to # more questions}}", {
              count: offer.questions,
            }),
          ]
        : []),
    ];
  };
}
