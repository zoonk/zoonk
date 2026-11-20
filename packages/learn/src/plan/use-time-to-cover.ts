"use client";

import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { useExtracted } from "next-intl";
import { usePlanScreen } from "./plan-context";
import { requestWithin } from "./request-within";

export type TimeToCoverAnswer =
  | { kind: "covers"; minutes: number }
  | { kind: "focus"; minutes: number; reachedShare: number }
  | { kind: "none" };

export function readTimeToCover(time: PlanTimeToCover): TimeToCoverAnswer {
  const { suggested } = time;

  if (!suggested) {
    return { kind: "none" };
  }

  return suggested.kind === "everything"
    ? { kind: "covers", minutes: suggested.minutes }
    : { kind: "focus", minutes: suggested.minutes, reachedShare: suggested.reachedShare };
}

export function useTimeToCover() {
  const { actions, timeToCover } = usePlanScreen();
  const { state } = timeToCover;

  return {
    answered: state.status === "answered" ? state.time : null,
    find: () =>
      timeToCover.find(async () => {
        const result = await requestWithin(() => actions.findTimeToCover());
        return result.status === "settled" ? result.value : null;
      }),
    state,
  };
}

export function useTimeToCoverTexts() {
  const t = useExtracted();

  return {
    building: t("Your plan is still being built. Try again in a moment."),
    failed: t("We couldn't work out the time needed."),
    finding: t("Finding the time that covers everything…"),
    noDate: t("We couldn't find a date that covers everything."),
    seeChanges: t("See what changes"),
    tryAgain: t("Try again"),
  };
}
