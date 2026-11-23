"use client";

import { useExtracted } from "next-intl";
import { usePlanScreen } from "./plan-context";
import { requestWithin } from "./request-within";

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
    noDate: t("We couldn't find a date that covers everything."),
    seeChanges: t("See what changes"),
    tryAgain: t("Try again"),
  };
}
