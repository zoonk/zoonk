"use client";

import { type FocusTestFocus } from "@zoonk/core/learner/placement/focus-test-contract";
import { useExtracted } from "next-intl";
import { type Decision } from "./focus-test-proposal";

/** The one line under the result's headline: what the plan does with what the test found. */
export function useResultLine() {
  const t = useExtracted();

  const startingPoint = (lessonsSkipped: number): string =>
    lessonsSkipped > 0
      ? t(
          "{count, plural, one {Your plan skips # lesson you already know.} other {Your plan skips # lessons you already know.}}",
          { count: lessonsSkipped },
        )
      : t({
          description:
            "The Focus test's result when no answer showed something the learner already knows: every exam subject starts at its first lessons.",
          message: "Your plan starts each subject from the basics.",
        });

  const answered = (decision: Decision): string => {
    switch (decision) {
      case "applied":
        return t({
          description:
            "After the learner agreed to give the listed exam subjects more time: the study plan changed.",
          message: "Your plan now gives these subjects more time.",
        });
      case "declined":
        return t("Your plan stays as it was.");
      case "undone":
        return t("Undone. Your plan is back as it was.");
      default:
        return decision satisfies never;
    }
  };

  const suggested = (state: FocusTestFocus["state"]): string => {
    switch (state) {
      case "current":
        return t({
          description:
            "Under “Here's where to focus”, above a list of exam subjects: the learner's study plan already gives them more time.",
          message: "Your plan gives these subjects more time.",
        });
      case "handPicked":
        return t({
          description:
            "Above the exam subjects the Focus test suggests: the learner picked other subjects to focus on, and the study plan keeps their pick. Use the same word for “focus” as “Change focus” and “Choose where to focus” do.",
          message: "Your plan keeps the focus you chose. This is what the test suggests.",
        });
      case "declined":
        return t({
          description:
            "Above the exam subjects the Focus test suggests: the learner answered “Not now” to giving them more time, so the study plan was left unchanged.",
          message: "You kept your plan as it is. This is what the test suggests.",
        });
      case "ifTimeShort":
      case "proposed":
      case "suggested":
        return t({
          description:
            "Under “Here's where to focus”, above a list of exam subjects: why the Focus test suggests these subjects, then the fact that focusing on them is never what removes a subject from the study plan. Do not say that every subject stays in the plan or that no subject is left out: with very little study time a subject can still end up with no lessons. Use the same word for “focus” as “Change focus” and “Choose where to focus” do.",
          message:
            "Based on your answers and what counts most in your exam. Focusing never removes a subject.",
        });
      default:
        return state satisfies never;
    }
  };

  return { answered, startingPoint, suggested };
}
