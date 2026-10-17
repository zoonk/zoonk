"use client";

import { type PlanTimeToCover, getRecommendedTime } from "@zoonk/core/plans/time-advice-contract";
import { safeAsync } from "@zoonk/utils/error";
import { settleWithin } from "@zoonk/utils/timeout";
import { useExtracted } from "next-intl";
import { useFormatGoalDate, useFormatIsoDate } from "../_utils/iso-date";
import { useFormatShare } from "../_utils/percent";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";

/** Planning a big exam's goal at every daily time takes seconds; past this, offer Try again. */
const ASK_TIMEOUT_MS = 45_000;

/**
 * What a find answer says about daily time: the fewest minutes whose plan covers everything in
 * depth by the date (`covers`); when none does, the most time a day with the exact share it covers
 * (`more`), when that's more than the learner's time does; otherwise no time covers more (`none`).
 */
export type TimeToCoverAnswer =
  | { kind: "covers"; minutes: number }
  | { kind: "more"; minutes: number; share: number }
  | { kind: "none" };

export function readTimeToCover(
  time: Pick<PlanTimeToCover, "maximum" | "recommendedMinutes">,
): TimeToCoverAnswer {
  const target = getRecommendedTime(time);

  if (!target) {
    return { kind: "none" };
  }

  return target.kind === "inDepth"
    ? { kind: "covers", minutes: target.dailyMinutes }
    : { kind: "more", minutes: target.dailyMinutes, share: target.coveredShare };
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
 * time step): what the time found covers by the goal's date, what the most time a day covers when
 * no time covers everything, and what a failed or interrupted search says.
 */
export function useTimeToCoverTexts() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatShare = useFormatShare();
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
    more: ({ minutes, share }: { minutes: number; share: number }) =>
      t("Even at {time} a day, you'd study about {share} of everything in depth by your date.", {
        share: formatShare(share),
        time: formatDuration(minutes),
      }),
    noDate: t("We couldn't find a date that covers everything."),
    none: (minutes: number) =>
      t("Even at {time} a day, your plan wouldn't cover more by your date.", {
        time: formatDuration(minutes),
      }),
    /** A chip's note once Find answered: the time found, or the most time's exact share. */
    note: (answer: TimeToCoverAnswer, minutes: number): string | null => {
      if (answer.kind === "covers" && answer.minutes === minutes) {
        return t("Covers everything");
      }

      return answer.kind === "more" && answer.minutes === minutes
        ? t("About {share}", { share: formatShare(answer.share) })
        : null;
    },
    tryAgain: t("Try again"),
  };
}
