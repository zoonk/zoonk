"use client";

import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { safeAsync } from "@zoonk/utils/error";
import { settleWithin } from "@zoonk/utils/timeout";
import { useExtracted } from "next-intl";
import { useFormatIsoDate, useGoalDateValues } from "../_utils/iso-date";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";

const ASK_TIMEOUT_MS = 45_000;

export type TimeToCoverAnswer =
  | { kind: "covers"; minutes: number }
  | {
      coveredShare: number;
      everyTopic: boolean;
      full: number | null;
      kind: "focus";
      minutes: number;
    }
  | { kind: "none" };

export function readTimeToCover({
  recommendedMinutes,
  suggested,
}: Pick<PlanTimeToCover, "recommendedMinutes" | "suggested">): TimeToCoverAnswer {
  if (!suggested) {
    return { kind: "none" };
  }

  return suggested.kind === "everything"
    ? { kind: "covers", minutes: suggested.minutes }
    : {
        coveredShare: suggested.coveredShare,
        everyTopic: suggested.everyTopic,
        full: recommendedMinutes,
        kind: "focus",
        minutes: suggested.minutes,
      };
}

export function getOfferedMinutes(answer: TimeToCoverAnswer | null): number | null {
  return answer && answer.kind !== "none" ? answer.minutes : null;
}

export function getFullMinutes(answer: TimeToCoverAnswer | null): number | null {
  return answer?.kind === "focus" ? answer.full : null;
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

type GoalDateFacts = Pick<PlanTimeToCover, "targetDateNamedMonth"> & { targetDate: string };

type FocusFacts = { coveredShare: number; everyTopic: boolean; exam: boolean };

export function useTimeToCoverTexts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatDate = useFormatIsoDate();
  const formatShare = useFormatShare();
  const goalDate = useGoalDateValues();

  const everythingTakes = ({
    minutes,
    targetDate,
    targetDateNamedMonth,
  }: GoalDateFacts & { minutes: number | null }) => {
    const dateValues = goalDate({
      isoDate: targetDate,
      namedMonth: targetDateNamedMonth,
      style: "long",
    });

    return minutes === null
      ? t({
          description:
            'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5".',
          message:
            "{dateKind, select, month {Not even a whole day covers everything in depth by {date}.} other {Not even a whole day covers everything in depth by {date}.}}",
          values: dateValues,
        })
      : t({
          description:
            'In the month form, {date} is a month, like "May 2027"; otherwise a day, like "May 5". {time} is a daily study time, like "13 h 30 min".',
          message:
            "{dateKind, select, month {Covering everything in depth by {date} takes about {time} a day, more than most people can keep up.} other {Covering everything in depth by {date} takes about {time} a day, more than most people can keep up.}}",
          values: { ...dateValues, time: formatDuration(minutes) },
        });
  };

  const focus = ({ coveredShare, everyTopic, exam }: FocusFacts) => {
    const shareValues = { share: formatShare(coveredShare) };

    if (exam) {
      return everyTopic
        ? t({
            description:
              '{share} is a percentage, like "32%": how much of everything gets studied in depth, not how many topics are reached.',
            message:
              "Your plan then covers every exam topic, the ones asked most in more depth. That's about {share} of the exam studied in depth.",
            values: shareValues,
          })
        : t({
            description:
              '{share} is a percentage, like "32%": how much of everything gets studied in depth, not how many topics are reached.',
            message:
              "Your plan then starts with what the exam asks most, about {share} of it studied in depth. Topics it asks least may not fit.",
            values: shareValues,
          });
    }

    return everyTopic
      ? t({
          description:
            '{share} is a percentage, like "32%": how much of everything gets studied in depth, not how many topics are reached.',
          message:
            "Your plan then covers every part of your goal, what matters most in more depth. That's about {share} of it studied in depth.",
          values: shareValues,
        })
      : t({
          description:
            '{share} is a percentage, like "32%": how much of everything gets studied in depth, not how many topics are reached.',
          message:
            "Your plan then starts with what matters most, about {share} of your goal studied in depth. The rest may not fit.",
          values: shareValues,
        });
  };

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
    everythingTakes,
    failed: t("We couldn't work out the time needed."),
    find: t("Find the time that covers everything"),
    finding: t("Finding the time…"),
    fittingDate: ({ dailyMinutes, fittingDate }: { dailyMinutes: number; fittingDate: string }) =>
      t({
        description: '{date} is a day, like "May 5".',
        message: "At {time} a day, your plan covers everything by {date}.",
        values: { date: formatDate(fittingDate, "long"), time: formatDuration(dailyMinutes) },
      }),
    focus,
    moreDays: t("More study days would help."),
    noDate: t("We couldn't find a date that covers everything."),
    suggest: (minutes: number) =>
      t({
        description:
          'A sentence before what that time covers. {time} is a daily study time, like "4 h".',
        message: "We suggest {time} a day.",
        values: { time: formatDuration(minutes) },
      }),
    suggestTitle: (minutes: number) =>
      t({
        description:
          'The title of a suggestion to change the daily study time. {time} is like "4 h".',
        message: "We suggest {time} a day",
        values: { time: formatDuration(minutes) },
      }),
    tooLong: t("That's more than most people can keep up."),
    tryAgain: t("Try again"),
    use: (minutes: number) =>
      t({
        description: "A button that changes the plan's daily time to the one just found.",
        message: "Use {time} a day",
        values: { time: formatDuration(minutes) },
      }),
  };
}
