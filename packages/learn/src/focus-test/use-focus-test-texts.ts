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

  function stateText(
    subject: Pick<FocusTestSubject, "asked" | "dontKnow" | "part" | "right" | "state">,
  ): string | null {
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

    // A subject with no answers has nothing to say.
    if (subject.state === "notAsked") {
      return null;
    }

    return t({
      description:
        "A part of the exam the Focus test's questions can't ask about, such as the essay.",
      message:
        "{part, select, written {Writing: not in this test} listening {Listening: not in this test} speaking {Speaking: not in this test} other {Practical part: not in this test}}",
      values: { part: subject.part ?? "other" },
    });
  }

  return stateText;
}

/** The test's invitation: also its row's line on the Plan while it hasn't started. */
export function useFocusTestTitle() {
  const t = useExtracted();

  return (suggestsFocus: boolean): string =>
    suggestsFocus ? t("Find what to study most") : t("Skip what you already know");
}

/**
 * What the test is and why, wherever it's offered. "It never removes a subject" is exact: focusing
 * gives some subjects more time and takes none out, though too little time can still leave one out.
 */
export function useFocusTestLine() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return {
    offer: (suggestsFocus: boolean): string =>
      suggestsFocus
        ? t(
            "This test shows what you already know, so more of your time goes to what you need most. It never removes a subject.",
          )
        : t("This test shows what you already know, so your plan can skip it."),
    timed: (minutes: number): string =>
      t({
        description: "{time} is a duration with its unit, such as “15 min”.",
        message:
          "A {time} test shows what you already know, so more of your time goes to what you need most. It never removes a subject.",
        values: { time: formatDuration(minutes) },
      }),
  };
}

export function useTestTime() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return {
    left: (minutes: number): string =>
      t({
        description: "{time} is a duration with its unit, such as “9 min”.",
        message: "{time} left",
        values: { time: formatDuration(minutes) },
      }),
    whole: (minutes: number): string => formatDuration(minutes),
  };
}

export function useSeeResultLabel(): string {
  const t = useExtracted();

  return t({
    description:
      "Button that ends the Focus test with the answers given so far and shows its result.",
    message: "See my result",
  });
}

export function useFocusTestRowFacts() {
  const t = useExtracted();
  const title = useFocusTestTitle();
  const time = useTestTime();

  return ({ offer, state, suggestsFocus }: FocusTestSummary): string[] => {
    if (state === "notStarted") {
      return [title(suggestsFocus), ...(offer ? [time.whole(offer.minutes)] : [])];
    }

    if (state === "sitting") {
      return [t("In progress"), ...(offer ? [time.left(offer.minutes)] : [])];
    }

    return [t("See your result")];
  };
}
