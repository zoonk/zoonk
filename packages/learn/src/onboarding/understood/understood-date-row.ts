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

const YEAR_LENGTH = 4;

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, YEAR_LENGTH));
}

const MONTHS_PER_YEAR = 12;

function readExamMonth(draft: GoalDraft): number | null {
  const month = draft.details?.examMonth;

  return typeof month === "number" &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= MONTHS_PER_YEAR
    ? month
    : null;
}

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

const SITTING_CHOICES = 3;

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
 * Offered with one tap, never put in place of the learner's date; an estimated day is never
 * offered.
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
      id: "targetDate",
      label: draft.kind === "exam" ? t("Exam date") : t("Deadline"),
      note: note ?? undefined,
      source: official?.source ?? suggested?.source ?? null,
      suggestedDate: suggested?.date,
      value: formatDate(targetDate, "longYear"),
    };
  };
}

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
