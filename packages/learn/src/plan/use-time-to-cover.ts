"use client";

import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { safeAsync } from "@zoonk/utils/error";
import { settleWithin } from "@zoonk/utils/timeout";
import { useExtracted } from "next-intl";
import { type FullTime, getFullTime } from "../_utils/time-answer";
import { usePlanScreen } from "./plan-context";

const ASK_TIMEOUT_MS = 45_000;

export type TimeToCoverAnswer =
  | { kind: "covers"; minutes: number }
  | { coveredShare: number; full: FullTime | null; kind: "focus"; minutes: number }
  | { kind: "none" };

export function readTimeToCover(time: PlanTimeToCover): TimeToCoverAnswer {
  const { suggested } = time;

  if (!suggested) {
    return { kind: "none" };
  }

  return suggested.kind === "everything"
    ? { kind: "covers", minutes: suggested.minutes }
    : {
        coveredShare: suggested.coveredShare,
        full: getFullTime(time),
        kind: "focus",
        minutes: suggested.minutes,
      };
}

export async function requestWithin<Answer>(
  request: () => Promise<Answer | null>,
): Promise<Answer | null> {
  const { data } = await safeAsync(() => settleWithin({ ms: ASK_TIMEOUT_MS, request }));
  return data?.status === "settled" ? data.value : null;
}

export function useTimeToCover() {
  const { actions, timeToCover } = usePlanScreen();
  const { state } = timeToCover;

  return {
    answered: state.status === "answered" ? state.time : null,
    find: () => timeToCover.find(() => requestWithin(() => actions.findTimeToCover())),
    state,
  };
}

export function useTimeToCoverTexts() {
  const t = useExtracted();

  return {
    building: t("Your plan is still being built. Try again in a moment."),
    failed: t("We couldn't work out the time needed."),
    find: t("Cover everything"),
    finding: t("Finding the time…"),
    noDate: t("We couldn't find a date that covers everything."),
    tryAgain: t("Try again"),
  };
}
