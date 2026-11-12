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

/** The test's invitation: also its row's line on the Plan while it hasn't started. */
export function useFocusTestTitle() {
  const t = useExtracted();

  return (suggestsFocus: boolean): string =>
    suggestsFocus
      ? t({
          description:
            "Headline that invites the learner to take the Focus test: quick questions that show which exam subjects need most of their study time. Keep it short: it is a headline, and it also sits on one line with a duration under “Focus test” in a list. Use the same word for “focus” as “Change focus” and “Choose where to focus” do.",
          message: "Find out where to focus",
        })
      : t({
          description:
            "The same headline for a goal with no exam date or with a single subject: there the Focus test only finds what the learner already knows, so their plan starts in the right place.",
          message: "Find out where to start",
        });
}

export function useSittingTime() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return {
    about: (minutes: number): string => t("About {time}", { time: formatDuration(minutes) }),
    aboutLeft: (minutes: number): string =>
      t({
        description:
          "{time} is a duration with its unit, such as “9 min”: about how long the rest of the Focus test takes. Keep it short: it shares one line with another fact, such as “In progress”.",
        message: "About {time} left",
        values: { time: formatDuration(minutes) },
      }),
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
  const { about, aboutLeft } = useSittingTime();

  return ({ offer, sessionQuestions, state, suggestsFocus }: FocusTestSummary): string[] => {
    if (state === "notStarted") {
      return [title(suggestsFocus), ...(offer ? [about(offer.minutes)] : [])];
    }

    if (state === "sitting") {
      return [
        t({
          description:
            "Under “Focus test” in a list: the learner started the test and has not finished it.",
          message: "In progress",
        }),
        ...(offer ? [aboutLeft(offer.minutes)] : []),
      ];
    }

    return [
      sessionQuestions === "paused"
        ? t({
            description:
              "Under “Focus test” in a list: the learner paused the Focus test questions that their study sessions ask.",
            message: "Paused in your sessions",
          })
        : t({
            description:
              "Under “Focus test” in a list, once the learner took the test: opens its result.",
            message: "See your result",
          }),
    ];
  };
}
