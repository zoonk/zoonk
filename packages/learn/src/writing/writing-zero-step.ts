"use client";

import { type WritingResult } from "@zoonk/core/exams/essays/writing-contract";
import { useExtracted } from "next-intl";

type ZeroKind = NonNullable<Extract<WritingResult, { kind: "points" }>["zeroKind"]>;

/**
 * A zeroed answer's next step, by the rule it broke. The notice's rule shows above it, so this says
 * what to do, never why it scored zero.
 */
export function useZeroStepCopy() {
  const t = useExtracted();

  return function zeroCopy(zeroKind: ZeroKind | undefined): { text: string; title: string } | null {
    switch (zeroKind) {
      case "blank":
        return {
          text: t("Start with the points the question asks for."),
          title: t("Write an answer"),
        };
      case "offTopic":
        return {
          text: t("Reread the question and write about what it asks."),
          title: t("Answer the question asked"),
        };
      case "wrongForm":
        return {
          text: t("Check what kind of text the question asks for, and write that."),
          title: t({
            description:
              "The next step of a written answer zeroed for being in the wrong form, such as a list where an essay was asked.",
            message: "Write it in the form asked",
          }),
        };
      case "tooFewLines":
        return {
          text: t("Develop each point the question asks for until you reach it."),
          title: t({
            description:
              "The next step of a written answer zeroed for being shorter than the exam's minimum number of lines.",
            message: "Reach the minimum length",
          }),
        };
      case "copiedSupport":
        return {
          text: t("Take the support text as a starting point, not as your answer."),
          title: t("Use your own words"),
        };
      case "identification":
        return {
          text: t("Remove names, signatures and marks that aren't part of the answer."),
          title: t("Leave out anything that identifies you"),
        };
      case undefined:
        return null;
      default:
        return zeroKind satisfies never;
    }
  };
}
