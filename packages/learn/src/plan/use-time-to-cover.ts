"use client";

import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { safeAsync } from "@zoonk/utils/error";
import { settleWithin } from "@zoonk/utils/timeout";
import { useExtracted } from "next-intl";
import { useFormatGoalDate, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";

const ASK_TIMEOUT_MS = 45_000;

export type TimeToCoverAnswer =
  | { kind: "covers"; minutes: number }
  | { coreMinutes: number | null; kind: "none" };

export function readTimeToCover(
  time: Pick<PlanTimeToCover, "coreMinutes" | "recommendedMinutes">,
): TimeToCoverAnswer {
  return time.recommendedMinutes === null
    ? { coreMinutes: time.coreMinutes, kind: "none" }
    : { kind: "covers", minutes: time.recommendedMinutes };
}

export function getOfferedMinutes(answer: TimeToCoverAnswer | null): number | null {
  if (!answer) {
    return null;
  }

  return answer.kind === "covers" ? answer.minutes : answer.coreMinutes;
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
  const formatDuration = useFormatDuration();
  const formatDate = useFormatIsoDate();
  const formatGoalDate = useFormatGoalDate();

  return {
    building: t("Your plan is still being built. Try again in a moment."),
    covers: ({
      minutes,
      targetDate,
      targetDateNamedMonth,
    }: { minutes: number } & Pick<PlanTimeToCover, "targetDateNamedMonth"> & {
        targetDate: string;
      }) =>
      t("{time} a day covers everything in depth by {date}.", {
        date: formatGoalDate({
          isoDate: targetDate,
          namedMonth: targetDateNamedMonth,
          style: "long",
        }),
        time: formatDuration(minutes),
      }),
    everyTopic: (minutes: number) =>
      t("{time} a day studies every topic, some in less depth.", { time: formatDuration(minutes) }),
    failed: t("We couldn't work out the time needed."),
    find: t("Find the time that covers everything"),
    finding: t("Finding the time…"),
    fittingDate: ({ dailyMinutes, fittingDate }: { dailyMinutes: number; fittingDate: string }) =>
      t("At {time} a day, your plan covers everything by {date}.", {
        date: formatDate(fittingDate, "long"),
        time: formatDuration(dailyMinutes),
      }),
    noDate: t("We couldn't find a date that covers everything."),
    none: ({
      targetDate,
      targetDateNamedMonth,
    }: Pick<PlanTimeToCover, "targetDateNamedMonth"> & { targetDate: string }) =>
      t("No amount of time a day covers everything in depth by {date}.", {
        date: formatGoalDate({
          isoDate: targetDate,
          namedMonth: targetDateNamedMonth,
          style: "long",
        }),
      }),
    note: (answer: TimeToCoverAnswer, minutes: number): string | null => {
      if (getOfferedMinutes(answer) !== minutes) {
        return null;
      }

      return answer.kind === "covers" ? t("Covers everything") : t("Every topic");
    },
    tryAgain: t("Try again"),
  };
}
