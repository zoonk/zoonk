"use client";

import { getExamDocument } from "@zoonk/core/exams/document";
import {
  findLearnerSitting,
  findMeantExamDay,
  getKeptMonthStart,
  getNamedMonthStart,
  hasSeveralSittings,
  listOpenSittings,
} from "@zoonk/core/exams/kept-month";
import { type GoalDraft } from "@zoonk/core/goals/contract";
import { type OnboardingExamDate } from "@zoonk/core/view-models/onboarding/contract";
import { useExtracted, useFormatter } from "next-intl";
import { daysUntilIsoDate, toLocalIsoDate, useFormatIsoDate } from "../../_utils/iso-date";
import { toLabelCase } from "../../_utils/label-case";
import { useNoticeDayText } from "../../plan/notice-day";
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

/**
 * The month the learner named when the plan keeps it (see `getKeptMonthStart`): over the notice's
 * day in another month, which the card offers one tap away, or, for an exam held several times a
 * year, with no sitting in their month to offer (see `findMeantExamDay`). The card says what the
 * plan does: their month.
 */
function useKeptMonthRow() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const noticeDayText = useNoticeDayText();

  return function keptMonthRow({
    draft,
    examDates,
  }: {
    draft: GoalDraft;
    examDates: OnboardingExamDate[];
  }): UnderstoodRow | null {
    const today = toLocalIsoDate(new Date());
    const details = draft.details;
    const noticeDay = findMeantExamDay({ days: examDates, details, from: today, goalDate: null });

    const keptMonth = noticeDay
      ? getKeptMonthStart({ details, noticeDay: noticeDay.date, today })
      : getNamedMonthStart({ details, from: today });

    if (!keptMonth) {
      return null;
    }

    return {
      editDefault: keptMonth,
      editable: { key: "targetDate", kind: "date" },
      icon: "calendar",
      id: "targetDate",
      label: t("Exam date"),
      note: noticeDay
        ? noticeDayText({
            date: noticeDay.date,
            document: getExamDocument(draft),
            estimated: false,
          })
        : undefined,
      source: noticeDay?.source ?? null,
      suggestedDate: noticeDay?.date,
      value: toLabelCase(formatDate(keptMonth, "month")),
    };
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

/**
 * The exam day the goal's date is, when a search or the notice gives it officially (any sitting the
 * learner picked): its source and days left.
 */
function findOfficialDay({
  draft,
  examDates,
}: {
  draft: GoalDraft;
  examDates: OnboardingExamDate[];
}): OnboardingExamDate | null {
  return (
    examDates.find((day) => day.source && !day.estimated && day.date === draft.targetDate) ?? null
  );
}

/** The sittings a learner without a date picks from: the next ones open for registration. */
const SITTING_CHOICES = 3;

/**
 * An exam held several times a year when the learner gave no date or month: the card asks which
 * sitting they'll take, from the next ones still open for registration, each one tap away. Until
 * they pick, the plan counts down to the first (see `findLearnerSitting`). Null for an exam of one
 * sitting, or fewer than two sittings to pick from.
 */
function useSittingChoiceRow() {
  const t = useExtracted();

  return function sittingChoiceRow({
    draft,
    examDates,
  }: {
    draft: GoalDraft;
    examDates: OnboardingExamDate[];
  }): UnderstoodRow | null {
    const from = toLocalIsoDate(new Date());
    const open = listOpenSittings({ count: SITTING_CHOICES, days: examDates, from });
    const [first] = open;

    if (
      readExamMonth(draft) !== null ||
      !hasSeveralSittings(examDates) ||
      !first ||
      open.length < 2
    ) {
      return null;
    }

    return {
      choiceDates: open.map((day) => day.date),
      editDefault: first.date,
      editLabel: t("Exam date"),
      editable: { key: "targetDate", kind: "date" },
      icon: "calendar",
      id: "examDates",
      label: t("Exam date"),
      note: t(
        "This exam is held several times a year. Until you pick one, your plan uses the first.",
      ),
      source: first.source,
      value: t("Pick your date"),
    };
  };
}

/**
 * The exam's days the learner prepares for: its one sitting, or, held several times a year, the
 * one in the month they named, else the next one open for registration (see `findLearnerSitting`).
 */
function findMeantSitting({
  draft,
  examDates,
}: {
  draft: GoalDraft;
  examDates: OnboardingExamDate[];
}): OnboardingExamDate[] {
  const from = toLocalIsoDate(new Date());
  const goalDate = getNamedMonthStart({ details: draft.details, from });

  return findLearnerSitting({ days: examDates, from, goalDate }) ?? examDates;
}

/**
 * The exam's official day when the learner's own date isn't one of its days: offered with one tap,
 * never put in its place. For an exam held several times a year, only the sitting in their date's
 * month (see `findMeantExamDay`). An estimated day is never offered over their date.
 */
function findSuggestedDay({
  draft,
  examDates,
}: {
  draft: GoalDraft;
  examDates: OnboardingExamDate[];
}): OnboardingExamDate | null {
  const day = findMeantExamDay({
    days: examDates,
    details: draft.details,
    from: toLocalIsoDate(new Date()),
    goalDate: draft.targetDate ?? null,
  });

  if (!day || day.estimated || examDates.some((date) => date.date === draft.targetDate)) {
    return null;
  }

  return day;
}

/** The learner's own date (or the one a search found), with what the notice says about it. */
function useOwnDateRow() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const noticeDayText = useNoticeDayText();

  return function ownDateRow({
    draft,
    examDates,
    targetDate,
  }: {
    draft: GoalDraft;
    examDates: OnboardingExamDate[];
    targetDate: string;
  }): UnderstoodRow {
    const official = findOfficialDay({ draft, examDates });
    const suggested = official ? null : findSuggestedDay({ draft, examDates });

    const note = official
      ? t("{days, plural, one {# day left} other {# days left}}", {
          days: daysUntilIsoDate({ isoDate: official.date, today: new Date() }),
        })
      : suggested &&
        noticeDayText({ date: suggested.date, document: getExamDocument(draft), estimated: false });

    return {
      editable: { key: "targetDate", kind: "date" },
      icon: "calendar",
      id: "targetDate",
      label: draft.kind === "exam" ? t("Exam date") : t("Deadline"),
      note: note ?? undefined,
      source: official?.source ?? suggested?.source ?? null,
      suggestedDate: suggested?.date,
      value: formatDate(targetDate, "longYear"),
    };
  };
}

/**
 * The goal's one date row: the day the learner or their words gave (with its official source when
 * a search found it, or the notice's day one tap away when it's another), else the exam's days
 * (official with their source, or estimated from its usual timing), else, for an exam whose
 * official day isn't out, that it's to be confirmed. The learner can set any full date on it.
 */
export function useDateRow() {
  const t = useExtracted();
  const examDaysValue = useExamDaysValue();
  const toBeConfirmed = useToBeConfirmed();
  const keptMonthRow = useKeptMonthRow();
  const sittingChoiceRow = useSittingChoiceRow();
  const ownDateRow = useOwnDateRow();

  return function toDateRow({
    draft,
    examDates,
  }: {
    draft: GoalDraft;
    examDates: OnboardingExamDate[];
  }): UnderstoodRow | null {
    if (draft.targetDate) {
      return ownDateRow({ draft, examDates, targetDate: draft.targetDate });
    }

    if (draft.kind !== "exam") {
      return null;
    }

    const [first] = examDates;

    if (!first) {
      return {
        editable: { key: "targetDate", kind: "date" },
        icon: "calendar",
        id: "targetDate",
        label: t("Exam date"),
        note: t(
          "{document, select, notice {The official date comes out in the exam's notice. Know it already? Set it here.} other {The official date comes out on the exam's official calendar. Know it already? Set it here.}}",
          { document: getExamDocument(draft) },
        ),
        value: toBeConfirmed({
          month: readExamMonth(draft),
          year: readExamYear({ dates: examDates, draft }),
        }),
      };
    }

    const estimated = examDates.some((date) => date.estimated);

    const kept = estimated
      ? null
      : (keptMonthRow({ draft, examDates }) ?? sittingChoiceRow({ draft, examDates }));

    if (kept) {
      return kept;
    }

    const sitting = estimated ? examDates : findMeantSitting({ draft, examDates });
    const [day = first] = sitting;

    return {
      editDefault: day.date,
      editLabel: t("Exam date"),
      editable: { key: "targetDate", kind: "date" },
      icon: "calendar",
      id: "examDates",
      label: t("{count, plural, one {Exam date} other {Exam dates}}", { count: sitting.length }),
      note: estimated
        ? t("From its usual dates. We'll tell you when the official ones are out.")
        : t("{days, plural, one {# day left} other {# days left}}", {
            days: daysUntilIsoDate({ isoDate: day.date, today: new Date() }),
          }),
      source: estimated ? null : day.source,
      value: examDaysValue(sitting),
    };
  };
}
