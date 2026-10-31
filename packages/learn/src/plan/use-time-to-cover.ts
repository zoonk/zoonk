"use client";

import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { safeAsync } from "@zoonk/utils/error";
import { settleWithin } from "@zoonk/utils/timeout";
import { useExtracted } from "next-intl";
import { useFormatIsoDate, useGoalDateValues } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";

const ASK_TIMEOUT_MS = 45_000;

export type TimeToCoverAnswer =
  | { kind: "covers"; minutes: number }
  | { everyTopicMinutes: number | null; kind: "none" };

/** Offers only core's suggestion: a day longer than anyone keeps up isn't offered, even when it covers everything. */
export function readTimeToCover({
  suggested,
}: Pick<PlanTimeToCover, "suggested">): TimeToCoverAnswer {
  return suggested?.kind === "everything"
    ? { kind: "covers", minutes: suggested.minutes }
    : { everyTopicMinutes: suggested?.minutes ?? null, kind: "none" };
}

export function getOfferedMinutes(answer: TimeToCoverAnswer | null): number | null {
  if (!answer) {
    return null;
  }

  return answer.kind === "covers" ? answer.minutes : answer.everyTopicMinutes;
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
  const goalDate = useGoalDateValues();

  return {
    building: t("Your plan is still being built. Try again in a moment."),
    covers: ({
      minutes,
      targetDate,
      targetDateNamedMonth,
    }: { minutes: number } & Pick<PlanTimeToCover, "targetDateNamedMonth"> & {
        targetDate: string;
      }) =>
      t({
        description:
          'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
        message:
          "{dateKind, select, month {{time} a day covers everything in depth by {date}.} other {{time} a day covers everything in depth by {date}.}}",
        values: {
          ...goalDate({ isoDate: targetDate, namedMonth: targetDateNamedMonth, style: "long" }),
          time: formatDuration(minutes),
        },
      }),
    everyTopic: (minutes: number) =>
      t("{time} a day studies every topic, some in less depth.", { time: formatDuration(minutes) }),
    failed: t("We couldn't work out the time needed."),
    find: t("Find the time that covers everything"),
    finding: t("Finding the time…"),
    fittingDate: ({ dailyMinutes, fittingDate }: { dailyMinutes: number; fittingDate: string }) =>
      t({
        description: '{date} is a day, like "May 5".',
        message: "At {time} a day, your plan covers everything by {date}.",
        values: { date: formatDate(fittingDate, "long"), time: formatDuration(dailyMinutes) },
      }),
    noDate: t("We couldn't find a date that covers everything."),
    none: t("Your date is too close to cover everything in depth."),
    tryAgain: t("Try again"),
    use: (minutes: number) =>
      t({
        description: "A button that changes the plan's daily time to the one just found.",
        message: "Use {time} a day",
        values: { time: formatDuration(minutes) },
      }),
  };
}
