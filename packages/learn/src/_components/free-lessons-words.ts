"use client";

import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useCallback, useSyncExternalStore } from "react";
import { useFormatIsoDate } from "../_utils/iso-date";
import { type OpeningDay, toOpeningDay, watchOpeningClock } from "../_utils/opening-day";
import {
  type FreeLessonsUsed,
  type LessonLimit,
  type LimitWords,
  type MindMapLimit,
} from "./help-limit-notice";

export function isFreeLessonsUsed(limit: LessonLimit): limit is FreeLessonsUsed {
  return "period" in limit && limit.period === "rolling30Days";
}

/** Also tells the screen when the tab is seen again (a computer that slept). */
function watchOpening(availableAt: string | null, notify: () => void) {
  const stop = watchOpeningClock(availableAt, notify);
  document.addEventListener("visibilitychange", notify);

  return () => {
    stop();
    document.removeEventListener("visibilitychange", notify);
  };
}

/**
 * The day follows the clock while the screen is open, so a passed instant stops being promised.
 * The server doesn't know the learner's time zone, so it draws the day in UTC and the browser
 * corrects it.
 */
export function useOpeningDay(availableAt: string | null): OpeningDay | null {
  const subscribe = useCallback(
    (notify: () => void) => watchOpening(availableAt, notify),
    [availableAt],
  );

  return useSyncExternalStore(
    subscribe,
    () => toOpeningDay({ availableAt, now: new Date(), timeZone: getLocalTimeZone() }),
    () => toOpeningDay({ availableAt, now: new Date(), timeZone: "UTC" }),
  );
}

type DayLines = {
  /** `date` is the day and its month in the learner's language, such as "November 22". */
  onDate: (date: string) => string;
  today: () => string;
  tomorrow: () => string;
};

/** The sentence for the day something opens, with no sentence once it's open or unreadable. */
function useDayLine() {
  const formatDate = useFormatIsoDate();

  return (opensOn: OpeningDay | null, lines: DayLines): string | undefined => {
    if (!opensOn || opensOn === "open") {
      return undefined;
    }

    if (opensOn === "today") {
      return lines.today();
    }

    if (opensOn === "tomorrow") {
      return lines.tomorrow();
    }

    return lines.onDate(formatDate(opensOn, "dayMonth"));
  };
}

export function useNextFreeLessonLine() {
  const t = useExtracted();
  const dayLine = useDayLine();

  return (opensOn: OpeningDay | null): string | undefined =>
    dayLine(opensOn, {
      onDate: (date) =>
        t({
          description:
            'On the screen a free learner sees when their free lessons are used. {date} is a day and its month, such as "November 22" in English.',
          message: "Your next free lesson opens on {date}, or subscribe to keep going.",
          values: { date },
        }),
      today: () => t("Your next free lesson opens later today, or subscribe to keep going."),
      tomorrow: () => t("Your next free lesson opens tomorrow, or subscribe to keep going."),
    });
}

/**
 * A map writes its lessons first, so a free learner's map waits until all of them fit in the
 * lessons they have left over the last 30 days; one that needs more lessons than that never fits.
 * The learner may have lessons left, so these words never say they used them.
 */
export function useMapLessonsWords() {
  const t = useExtracted();
  const dayLine = useDayLine();

  return (
    limit: Extract<MindMapLimit, { status: "limitReached" }>,
    opensOn: OpeningDay | null,
  ): LimitWords => {
    if (!isFreeLessonsUsed(limit)) {
      return {
        line: t({
          description:
            "Under the title of a notice on a chapter's mind map: making the map writes its lessons first, and this one has more lessons than a free learner can start.",
          message: "It writes more lessons than you get for free.",
        }),
        title: t("This map needs a subscription"),
      };
    }

    if (opensOn === "open") {
      return { title: t("You can make this map now") };
    }

    return {
      line: dayLine(opensOn, {
        onDate: (date) =>
          t({
            description:
              "Under the title of a notice on a chapter's mind map: making the map writes its lessons first, and the free learner doesn't have enough free lessons left for all of them yet. {date} is a day and its month, such as \"November 22\" in English.",
            message: "You'll have enough on {date}, or subscribe to make it now.",
            values: { date },
          }),
        today: () =>
          t({
            description:
              "Under the title of a notice on a chapter's mind map: making the map writes its lessons first, and the free learner doesn't have enough free lessons left for all of them yet.",
            message: "You'll have enough later today, or subscribe to make it now.",
          }),
        tomorrow: () =>
          t({
            description:
              "Under the title of a notice on a chapter's mind map: making the map writes its lessons first, and the free learner doesn't have enough free lessons left for all of them yet.",
            message: "You'll have enough tomorrow, or subscribe to make it now.",
          }),
      }),
      title: t("Not enough free lessons for this map yet"),
    };
  };
}
