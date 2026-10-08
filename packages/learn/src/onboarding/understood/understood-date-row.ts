"use client";

import { type GoalDraft } from "@zoonk/core/goals/contract";
import { type OnboardingExamDate } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted, useFormatter } from "next-intl";
import { daysUntilIsoDate, useFormatIsoDate } from "../../_utils/iso-date";
import { type UnderstoodRow } from "./use-understood-rows";

const NO_BREAK_SPACE = " ";

/** "2028" in "2028-11-12". */
const YEAR_LENGTH = 4;

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, YEAR_LENGTH));
}

const MONTHS_PER_YEAR = 12;

/** The exam's month the learner named ("in March"), 1 to 12, or null. */
function readExamMonth(draft: GoalDraft): number | null {
  const month = draft.details?.examMonth;

  return typeof month === "number" &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= MONTHS_PER_YEAR
    ? month
    : null;
}

/**
 * An exam without its official day, as far as the learner's words go: "March 2027, to be
 * confirmed" when they named the month, else the year, else just to be confirmed.
 */
function useToBeConfirmed() {
  const t = useExtracted();
  const format = useFormatter();

  return ({ month, year }: { month: number | null; year: number | null }): string => {
    if (year === null) {
      return t("To be confirmed");
    }

    if (month === null) {
      return t("{year}, to be confirmed", { year: String(year) });
    }

    const date = format.dateTime(new Date(Date.UTC(year, month - 1, 1)), {
      month: "long",
      timeZone: "UTC",
      year: "numeric",
    });

    return t("{date}, to be confirmed", { date });
  };
}

/** "1" in "2027-01-10". */
function monthOf(isoDate: string): number {
  return Number(isoDate.slice(YEAR_LENGTH + 1, YEAR_LENGTH + 3));
}

/**
 * "You said March; the notice sets this date.": the month the learner named, when the official
 * day the card shows is in another one, so their words are answered instead of overwritten.
 * Null when they named no month or it's the official day's.
 */
function useSaidMonthNote() {
  const t = useExtracted();
  const format = useFormatter();

  return function saidMonthNote({
    draft,
    official,
  }: {
    draft: GoalDraft;
    official: string;
  }): string | null {
    const month = readExamMonth(draft);

    if (month === null || month === monthOf(official)) {
      return null;
    }

    const said = format.dateTime(new Date(Date.UTC(yearOf(official), month - 1, 1)), {
      month: "long",
      timeZone: "UTC",
    });

    return t("You said {month}; the notice sets this date.", { month: said });
  };
}

/** The exam's year: the one the learner named, else the year of its next dates. */
function readExamYear({
  dates,
  draft,
}: {
  dates: OnboardingExamDate[];
  draft: GoalDraft;
}): number | null {
  const named = draft.details?.examYear;

  if (typeof named === "number") {
    return named;
  }

  const [first] = dates;
  return first ? yearOf(first.date) : null;
}

/**
 * The exam's days in one line, the year said once at the end when they share it ("November 8
 * and November 15, 2026"). Each day stays on one line; a long list breaks between days.
 */
function useExamDaysValue() {
  const format = useFormatter();
  const formatDate = useFormatIsoDate();

  return (dates: OnboardingExamDate[]): string => {
    const sameYear = new Set(dates.map((date) => yearOf(date.date))).size === 1;
    const last = dates.length - 1;

    return format.list(
      dates.map((date, index) =>
        formatDate(date.date, sameYear && index < last ? "dayMonth" : "longYear").replaceAll(
          " ",
          NO_BREAK_SPACE,
        ),
      ),
      { type: "conjunction" },
    );
  };
}

/** The exam day a search found, when the goal's date is that day: its source and days left. */
function findOfficialDay({
  draft,
  examDates,
}: {
  draft: GoalDraft;
  examDates: OnboardingExamDate[];
}): OnboardingExamDate | null {
  const [first] = examDates;
  return first?.source && !first.estimated && first.date === draft.targetDate ? first : null;
}

/**
 * The goal's one date row, so the card never shows a year and a deadline side by side: the day
 * the learner or their words gave (with its official source when a search found it), else the
 * exam's days (official with their source, or estimated from its usual timing), else, for an exam
 * whose official day isn't out, that it's to be confirmed. A stored notice's days are fixed by
 * changing the exam's year, which reads that year's days; every other date is fixed in place.
 */
export function useDateRow() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const examDaysValue = useExamDaysValue();
  const toBeConfirmed = useToBeConfirmed();
  const saidMonthNote = useSaidMonthNote();

  return function toDateRow({
    draft,
    examDates,
  }: {
    draft: GoalDraft;
    examDates: OnboardingExamDate[];
  }): UnderstoodRow | null {
    if (draft.targetDate) {
      const official = findOfficialDay({ draft, examDates });

      return {
        editable: { key: "targetDate", kind: "date" },
        icon: "calendar",
        id: "targetDate",
        label: draft.kind === "exam" ? t("Exam date") : t("Deadline"),
        note: official
          ? (saidMonthNote({ draft, official: official.date }) ??
            t("{days, plural, one {# day left} other {# days left}}", {
              days: daysUntilIsoDate({ isoDate: official.date, today: new Date() }),
            }))
          : undefined,
        source: official?.source ?? null,
        value: formatDate(draft.targetDate, "longYear"),
      };
    }

    if (draft.kind !== "exam") {
      return null;
    }

    const year = readExamYear({ dates: examDates, draft });
    const [first] = examDates;

    if (!first) {
      return {
        editable: { key: "targetDate", kind: "date" },
        icon: "calendar",
        id: "targetDate",
        label: t("Exam date"),
        note: t("The official date comes out in the exam's notice. Know it already? Set it here."),
        value: toBeConfirmed({ month: readExamMonth(draft), year }),
      };
    }

    const estimated = examDates.some((date) => date.estimated);

    return {
      editDefault: String(year ?? yearOf(first.date)),
      editLabel: t("Exam year"),
      editable: { key: "examYear", kind: "year" },
      icon: "calendar",
      id: "examDates",
      label: t("{count, plural, one {Exam date} other {Exam dates}}", { count: examDates.length }),
      note: estimated
        ? t("From its usual dates. We'll tell you when the official ones are out.")
        : (saidMonthNote({ draft, official: first.date }) ??
          t("{days, plural, one {# day left} other {# days left}}", {
            days: daysUntilIsoDate({ isoDate: first.date, today: new Date() }),
          })),
      source: estimated ? null : first.source,
      value: examDaysValue(examDates),
    };
  };
}
