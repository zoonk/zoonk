"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted, useFormatter } from "next-intl";
import { useCallback, useSyncExternalStore } from "react";
import { isoDateToUtc } from "../_utils/iso-date";
import {
  OPENING_DATE_OPTIONS,
  type OpeningDay,
  toFirstRenderDay,
  toOpeningDay,
  watchOpeningClock,
} from "../_utils/opening-day";
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

/** The day follows the clock while the screen is open, so a passed instant stops being promised. */
export function useOpeningDay(availableAt: string | null): OpeningDay | null {
  const subscribe = useCallback(
    (notify: () => void) => watchOpening(availableAt, notify),
    [availableAt],
  );

  return useSyncExternalStore(
    subscribe,
    () => toOpeningDay({ availableAt, now: new Date(), timeZone: getLocalTimeZone() }),
    () => toFirstRenderDay(availableAt),
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
  const format = useFormatter();

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

    return lines.onDate(format.dateTime(isoDateToUtc(opensOn), OPENING_DATE_OPTIONS));
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
export function useComesBackLine(limit: HelpLimit): LimitWords {
  const lineFor = useLineFor();
  const known = useIsMounted();
  const opensOn = useOpeningDay(isRollingCap(limit) ? limit.availableAt : null);
  const line = lineFor(limit, opensOn);

  return { line, provisional: !known && opensOn !== null && line !== undefined };
}

function useLimitSentence() {
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
  const known = useIsMounted();
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
    provisional: !known,
    title: t("Not enough free lessons for this map yet"),
  };
}

export type RefusedCap = {
  availableAt?: string | null;
  period: "day" | "rolling30Days" | "total";
  tier: EntitlementTier;
};

/** A cap's words kept as the refusal brought them: with `cap`, the line is said when it shows. */
export type CapWords = LimitWords & { cap?: RefusedCap };

/** A message that stays on screen: plain words, or a cap's, whose line follows the clock. */
export type LimitText = string | CapWords;

function toHelpLimit({ availableAt = null, period, tier }: RefusedCap): HelpLimit {
  return period === "rolling30Days"
    ? { availableAt, period, status: "limitReached", tier }
    : { period, status: "limitReached", tier };
}

export function toCapWords(cap: RefusedCap, titles: { day: string; rolling: string }): CapWords {
  return { cap, title: cap.period === "rolling30Days" ? titles.rolling : titles.day };
}

export function useLiveWords(words: CapWords | null): LimitWords {
  const lineFor = useLineFor();
  const known = useIsMounted();
  const limit = words?.cap ? toHelpLimit(words.cap) : null;
  const opensOn = useOpeningDay(limit && isRollingCap(limit) ? limit.availableAt : null);

  if (!words) {
    return {};
  }

  return {
    line: limit ? lineFor(limit, opensOn) : words.line,
    provisional: !known && opensOn !== null,
    title: words.title,
  };
}

/** `hidden` while its day can't be named yet: the text keeps its place without showing. */
export function useLimitText(text: LimitText | null | undefined): {
  hidden: boolean;
  text: string;
} {
  const sentence = useLimitSentence();
  const words = useLiveWords(text && typeof text === "object" ? text : null);

  if (!text) {
    return { hidden: false, text: "" };
  }

  return typeof text === "string"
    ? { hidden: false, text }
    : { hidden: words.provisional === true, text: sentence(words) };
}
