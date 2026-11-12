"use client";

import {
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
  };
}

export function useFocusTestStateFacts() {
  const t = useExtracted();
  const { about } = useSittingFacts();

  return ({ offer, state }: FocusTestSummary): string[] => {
    const time = offer ? [about(offer.minutes)] : [];

    if (state === "notStarted") {
      return [t("Not started"), ...time];
    }

    return state === "sitting" ? [t("Continue"), ...time] : [t("Your answers are in your plan")];
  };
}
