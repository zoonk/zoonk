"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { useCallback, useSyncExternalStore } from "react";
import { useFormatIsoDate } from "../_utils/iso-date";
import { type OpeningDay, toOpeningDay, watchOpeningClock } from "../_utils/opening-day";
import {
  type FreeLessonsUsed,
  type HelpLimit,
  type LessonLimit,
  type LimitWords,
  type MindMapLimit,
} from "./help-limit-notice";

export function isRollingCap(limit: HelpLimit | LessonLimit): limit is FreeLessonsUsed {
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

    return lines.onDate(formatDate(opensOn, "long"));
  };
}

/**
 * Its own namespace (`limits`), which apps ship on every page, so a goal refused on a public page
 * says when more comes back in the same words as every other cap.
 */
function useLines() {
  const t = useExtracted("limits");

  const subscribe: DayLines = {
    onDate: (date) =>
      t({
        description:
          'The line under the title of a notice that something the learner uses ran out, such as their messages to the study buddy or their free lessons: the day more comes back. {date} is a day and its month, such as "November 22" in English.',
        message: "More on {date}, or subscribe to keep going.",
        values: { date },
      }),
    today: () =>
      t({
        description:
          "The line under the title of a notice that something the learner uses ran out, such as their messages to the study buddy or their free lessons: when more comes back.",
        message: "More later today, or subscribe to keep going.",
      }),
    tomorrow: () =>
      t({
        description:
          "The line under the title of a notice that something the learner uses ran out, such as their messages to the study buddy or their free lessons: when more comes back.",
        message: "More tomorrow, or subscribe to keep going.",
      }),
  };

  const wait: DayLines = {
    onDate: (date) =>
      t({
        description:
          'The line under the title of a notice that something the learner uses ran out, such as their messages to the study buddy or their free lessons: the day more comes back. {date} is a day and its month, such as "November 22" in English.',
        message: "More on {date}.",
        values: { date },
      }),
    today: () =>
      t({
        description:
          "The line under the title of a notice that something the learner uses ran out, such as their messages to the study buddy or their free lessons: when more comes back.",
        message: "More later today.",
      }),
    tomorrow: () =>
      t({
        description:
          "The line under the title of a notice that something the learner uses ran out, such as their messages to the study buddy or their free lessons: when more comes back.",
        message: "More tomorrow.",
      }),
  };

  const ready = () =>
    t({
      description:
        "The line under the title of a notice that something the learner uses ran out, such as their messages to the study buddy or their free lessons: when more comes back.",
      message: "You can try again now.",
    });

  return { ready, subscribe, wait };
}

function useLineFor() {
  const dayLine = useDayLine();
  const { ready, subscribe, wait } = useLines();

  return (limit: HelpLimit, opensOn: OpeningDay | null): string | undefined => {
    if (limit.status !== "limitReached" || limit.tier === "guest" || limit.period === "total") {
      return undefined;
    }

    const lines = limit.tier === "plus" ? wait : subscribe;

    if (!isRollingCap(limit)) {
      return lines.tomorrow();
    }

    return opensOn === "open" ? ready() : dayLine(opensOn, lines);
  };
}

/**
 * When a used-up cap comes back, as the one line under its title. A cap over the last 30 days gives
 * the day its oldest use turns 30 days old, from the server's `availableAt`; a day's cap comes back
 * tomorrow. A free learner can also subscribe; a guest's way on is the button, so theirs has no line.
 */
export function useComesBackLine(limit: HelpLimit): string | undefined {
  const lineFor = useLineFor();
  return lineFor(limit, useOpeningDay(isRollingCap(limit) ? limit.availableAt : null));
}

/** The same line, read once when a refusal comes back, for words that are written as it arrives. */
export function useComesBackLineNow() {
  const lineFor = useLineFor();

  return (limit: HelpLimit): string | undefined =>
    lineFor(
      limit,
      toOpeningDay({
        availableAt: isRollingCap(limit) ? limit.availableAt : null,
        now: new Date(),
        timeZone: getLocalTimeZone(),
      }),
    );
}

/** A cap's words as one sentence, where a gate is a single line: a toast, an error, an answer. */
export function useLimitSentence() {
  const t = useExtracted("limits");

  return ({ line, title }: LimitWords): string => {
    if (title && line) {
      return t({
        description:
          'A notice that something the learner uses ran out, as one line: {title} says what ran out, such as "You\'ve used your uploads", and {line} when more comes back, such as "More on November 22, or subscribe to keep going."',
        message: "{title}. {line}",
        values: { line, title },
      });
    }

    return title ?? line ?? "";
  };
}

/**
 * A map writes its lessons first, so a free learner's map waits until all of them fit in the
 * lessons they have left over the last 30 days; one that needs more lessons than the free plan has
 * never fits.
 * The learner may have lessons left, so these words never say they used them.
 */
export function useMapLessonsWords(limit: MindMapLimit): LimitWords | null {
  const t = useExtracted();
  const dayLine = useDayLine();
  const opensOn = useOpeningDay(isRollingCap(limit) ? limit.availableAt : null);

  if (limit.status !== "limitReached") {
    return null;
  }

  if (!isRollingCap(limit)) {
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
}

/** A cap's period and tier as a refusal brings them; `availableAt` for one over the last 30 days. */
type RefusedCap = {
  availableAt?: string | null;
  period: "day" | "rolling30Days" | "total";
  tier: EntitlementTier;
};

/** One sentence for a cap refused as it was asked for: its title for the period, then when more comes back. */
export function useCapSentence() {
  const comesBack = useComesBackLineNow();
  const sentence = useLimitSentence();

  return (
    { availableAt = null, period, tier }: RefusedCap,
    titles: { day: string; rolling: string },
  ): string => {
    const limit: HelpLimit =
      period === "rolling30Days"
        ? { availableAt, period, status: "limitReached", tier }
        : { period, status: "limitReached", tier };

    return sentence({
      line: comesBack(limit),
      title: period === "rolling30Days" ? titles.rolling : titles.day,
    });
  };
}

/**
 * When a start that needs more than is left (a speaking task of a set length) fits whole: the day
 * the server's `availableAt` gives, or tomorrow for a day's cap. The learner may have some left, so
 * these words never say they used it.
 */
export function useEnoughLine(limit: HelpLimit): string | undefined {
  const t = useExtracted();
  const dayLine = useDayLine();
  const { ready } = useLines();
  const opensOn = useOpeningDay(isRollingCap(limit) ? limit.availableAt : null);

  if (limit.status !== "limitReached" || limit.tier === "guest" || limit.period === "total") {
    return undefined;
  }

  const lines: DayLines =
    limit.tier === "plus"
      ? {
          onDate: (date) =>
            t({
              description:
                "Under the title of a notice that the learner doesn't have enough call time left for a speaking task or mock exam of a set length: when they'll have enough for the whole of it.",
              message: "You'll have enough on {date}.",
              values: { date },
            }),
          today: () =>
            t({
              description:
                "Under the title of a notice that the learner doesn't have enough call time left for a speaking task or mock exam of a set length: when they'll have enough for the whole of it.",
              message: "You'll have enough later today.",
            }),
          tomorrow: () =>
            t({
              description:
                "Under the title of a notice that the learner doesn't have enough call time left for a speaking task or mock exam of a set length: when they'll have enough for the whole of it.",
              message: "You'll have enough tomorrow.",
            }),
        }
      : {
          onDate: (date) =>
            t({
              description:
                "Under the title of a notice that the learner doesn't have enough call time left for a speaking task or mock exam of a set length: when they'll have enough for the whole of it.",
              message: "You'll have enough on {date}, or subscribe to keep going.",
              values: { date },
            }),
          today: () =>
            t({
              description:
                "Under the title of a notice that the learner doesn't have enough call time left for a speaking task or mock exam of a set length: when they'll have enough for the whole of it.",
              message: "You'll have enough later today, or subscribe to keep going.",
            }),
          tomorrow: () =>
            t({
              description:
                "Under the title of a notice that the learner doesn't have enough call time left for a speaking task or mock exam of a set length: when they'll have enough for the whole of it.",
              message: "You'll have enough tomorrow, or subscribe to keep going.",
            }),
        };

  if (!isRollingCap(limit)) {
    return lines.tomorrow();
  }

  return opensOn === "open" ? ready() : dayLine(opensOn, lines);
}
