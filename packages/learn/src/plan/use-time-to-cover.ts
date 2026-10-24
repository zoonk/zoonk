"use client";

import { type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";
import { safeAsync } from "@zoonk/utils/error";
import { settleWithin } from "@zoonk/utils/timeout";
import { useExtracted } from "next-intl";
import { useFormatGoalDate, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";

/** Planning a big exam's goal at every daily time takes seconds; past this, offer Try again. */
const ASK_TIMEOUT_MS = 45_000;

/**
 * What a find answer says about daily time: the fewest minutes whose plan covers everything in
 * depth by the date (`covers`), or that no time a day does (`none`).
 */
export type TimeToCoverAnswer = { kind: "covers"; minutes: number } | { kind: "none" };

export function readTimeToCover(
  time: Pick<PlanTimeToCover, "recommendedMinutes">,
): TimeToCoverAnswer {
  return time.recommendedMinutes === null
    ? { kind: "none" }
    : { kind: "covers", minutes: time.recommendedMinutes };
}

/**
 * Asks once for something the learner asked the app to work out (the time that covers a goal, a
 * recommendation for its bases), within a bound wait: the answer, or null when it failed or timed
 * out, so a stalled request never leaves a spinner for good.
 */
export async function requestWithin<Answer>(
  request: () => Promise<Answer | null>,
): Promise<Answer | null> {
  const { data } = await safeAsync(() => settleWithin({ ms: ASK_TIMEOUT_MS, request }));
  return data?.status === "settled" ? data.value : null;
}

/**
 * "Find the time that covers everything" for the plan as it is now, shared by the Plan's coverage
 * card, its editor and Move your date (see `TimeToCoverState`). `find` plans the goal at each
 * daily time once per plan revision, within a bound wait: asked again while it runs, it waits for
 * that search, and once answered, it gives that answer; a late answer for a plan that changed
 * meanwhile shows nowhere. `answered` is this plan's answer.
 */
export function useTimeToCover() {
  const { actions, timeToCover } = usePlanScreen();
  const { state } = timeToCover;

  return {
    answered: state.status === "answered" ? state.time : null,
    find: () => timeToCover.find(() => requestWithin(() => actions.findTimeToCover())),
    state,
  };
}

/**
 * The words of a find answer and its states, the same wherever Find shows (the editor's time, the
 * time step): what the time found covers by the goal's date, that no time a day covers everything
 * by it, and what a failed or interrupted search says.
 */
export function useTimeToCoverTexts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatDate = useFormatIsoDate();
  const formatGoalDate = useFormatGoalDate();

  return {
    building: t("Your plan is still being built. Try again in a moment."),
    /** "1 hr 25 min a day covers everything in depth by March 3": by the goal's own date. */
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
    failed: t("We couldn't work out the time needed."),
    find: t("Find the time that covers everything"),
    finding: t("Finding the time…"),
    /** The date a goal's own time covers everything by. */
    fittingDate: ({ dailyMinutes, fittingDate }: { dailyMinutes: number; fittingDate: string }) =>
      t("At {time} a day, your plan covers everything by {date}.", {
        date: formatDate(fittingDate, "long"),
        time: formatDuration(dailyMinutes),
      }),
    noDate: t("We couldn't find a date that covers everything."),
    /** No time a day covers everything in depth by the goal's own date. */
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
    /** A chip's note once Find answered: the time found. */
    note: (answer: TimeToCoverAnswer, minutes: number): string | null =>
      answer.kind === "covers" && answer.minutes === minutes ? t("Covers everything") : null,
    tryAgain: t("Try again"),
  };
}
