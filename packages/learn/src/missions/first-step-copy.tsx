"use client";

import { useExtracted } from "next-intl";
import { type FirstStep } from "../buddies/buddy-status-view";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { useFormatPlanDate } from "../plan/plan-date-text";
import { WaitLine, renderSentenceNumber } from "./mission-copy";

/**
 * "Finish your first lesson": a first step by its name, each the first real use of something the
 * learner's plan has. The steps a mission already names ("Practice a pattern") keep its words.
 */
export function useFirstStepName(buddy: LearnBuddy | null) {
  const t = useExtracted("missions");
  const buddyName = useBuddyName(buddy);

  return (kind: FirstStep["kind"]): string => {
    switch (kind) {
      case "somethingNew":
        return t("Finish your first lesson");
      case "review":
        return t("Do your first review");
      case "fixMistake":
        return t("Fix your first mistake");
      case "pattern":
        return t("Practice a pattern");
      case "askBuddy":
        return t("Ask {buddy} something", { buddy: buddyName });
      case "essay":
        return t("Write your first essay");
      case "call":
        return t("Have your first call");
      case "mock":
        return t("Take your first mock");
      case "challenge":
        return t("Take on the Trickster");
      default:
        return kind satisfies never;
    }
  };
}

/** When a first step that can't be done yet comes ("With your first challenge, Oct 19"). */
function FirstStepWhen({ when }: { when: NonNullable<FirstStep["when"]> }) {
  const t = useExtracted();
  const formatPlanDate = useFormatPlanDate();

  switch (when.kind) {
    case "challenge":
      return when.date
        ? t.rich("With your first challenge, <mono>{date}</mono>", {
            date: formatPlanDate(when.date),
            mono: renderSentenceNumber,
          })
        : t("With your first challenge");
    case "essay":
      return t("On your first essay day");
    case "mistake":
      return t("The day after your first mistake");
    case "review":
      return t("When your first review is due");
    case "pattern":
      return t("When your mistakes show a pattern");
    case "call":
      return t("When you have call time again");
    case "buddy":
      return t("When you can ask again");
    case "lesson":
      return t("On your next lesson day");
    case "mock":
      return t("When your plan has a mock");
    default:
      return when satisfies never;
  }
}

/**
 * Where a first step stands, under its name: one of today's missions, there to do any time, what
 * its block waits for, or when it comes. A step done says nothing more: its check does.
 */
export function FirstStepDetailLine({ step }: { step: FirstStep }) {
  const t = useExtracted();

  if (step.waitReason) {
    return <WaitLine reason={step.waitReason} />;
  }

  if (step.status === "today") {
    return t("One of today's missions");
  }

  if (step.status === "available") {
    return t("Anytime");
  }

  return step.when ? <FirstStepWhen when={step.when} /> : null;
}
