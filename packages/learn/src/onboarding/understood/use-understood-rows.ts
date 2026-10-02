"use client";

import { type GoalDraft } from "@zoonk/core/goals/contract";
import {
  type OnboardingExamDate,
  type UnderstoodSchedule,
} from "@zoonk/core/view-models/onboarding/contract";
import { getLanguageName } from "@zoonk/utils/languages";
import { useExtracted, useFormatter, useLocale } from "next-intl";
import { daysUntilIsoDate, useFormatIsoDate } from "../../_utils/iso-date";
import { useFormatTimeOfDay } from "../../_utils/time-format";

/**
 * A fact the learner can fix in place: the goal's title and date, one of its details, or when
 * they study (shared by every goal of the onboarding).
 */
export type EditableField =
  | { kind: "date"; key: "targetDate" }
  | {
      kind: "text";
      key: "institution" | "reason" | "role" | "targetCourse" | "targetPosition" | "targetScore";
    }
  | { kind: "text"; key: "title" }
  | { kind: "time"; key: "studyTime" }
  | { kind: "year"; key: "examYear" };

export type UnderstoodRowIcon =
  | "calendar"
  | "clock"
  | "course"
  | "goal"
  | "language"
  | "level"
  | "reason"
  | "speaks"
  | "target"
  | "work"
  | "year";

export type UnderstoodRow = {
  /** A small marker next to the value, such as "you said" for a level or "estimated" for dates. */
  badge?: string;
  editable?: EditableField;
  /** What the editor starts from when the field is still empty, such as the official date. */
  editDefault?: string;
  icon: UnderstoodRowIcon;
  id: string;
  label: string;
  note?: string;
  source?: { title: string | null; url: string } | null;
  value: string;
};

function readText(details: GoalDraft["details"], key: string): string | null {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

const NO_BREAK_SPACE = "\u00A0";

/** "2028" in "2028-11-12". */
const YEAR_LENGTH = 4;

function yearOf(isoDate: string): number {
  return Number(isoDate.slice(0, YEAR_LENGTH));
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
 * The year of the exam the learner is preparing for, to fix in place: another year reads that
 * year's dates. Shown for exams whose dates or year are known.
 */
function useExamYearRow() {
  const t = useExtracted();

  return function toExamYearRow(year: number | null): UnderstoodRow | null {
    if (year === null) {
      return null;
    }

    return {
      editable: { key: "examYear", kind: "year" },
      icon: "year",
      id: "examYear",
      label: t("Exam year"),
      value: String(year),
    };
  };
}

function useExamRow() {
  const t = useExtracted();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();

  return function toExamRow({
    dates,
    year,
  }: {
    dates: OnboardingExamDate[];
    /** The exam year shown just above; days in another year say theirs. */
    year: number | null;
  }): UnderstoodRow | null {
    const [first] = dates;

    if (!first) {
      return null;
    }

    const estimated = dates.some((date) => date.estimated);

    // The learner can pick their own day; official dates stay one tap away in their source, and
    // dates guessed from the exam's usual timing say so.
    return {
      badge: estimated ? t("estimated") : undefined,
      editDefault: first.date,
      editable: { key: "targetDate", kind: "date" },
      icon: "calendar",
      id: "examDates",
      label: t("Dates"),
      note: estimated
        ? t("From its usual dates. The official ones aren't out yet.")
        : t("{days, plural, one {# day left} other {# days left}}", {
            days: daysUntilIsoDate({ isoDate: first.date, today: new Date() }),
          }),
      source: estimated ? null : first.source,
      // Each day stays on one line; a long list breaks between days.
      value: format.list(
        dates.map((date) =>
          formatDate(date.date, yearOf(date.date) === year ? "dayMonth" : "longYear").replaceAll(
            " ",
            NO_BREAK_SPACE,
          ),
        ),
        { type: "conjunction" },
      ),
    };
  };
}

function useLanguageRows() {
  const t = useExtracted();
  const locale = useLocale();

  return (draft: GoalDraft): UnderstoodRow[] => {
    const nativeLanguage = readText(draft.details, "nativeLanguage") ?? draft.language;

    return draft.kind === "language" && draft.targetLanguage
      ? [
          {
            icon: "language",
            id: "targetLanguage",
            label: t("Language"),
            value: getLanguageName({ targetLanguage: draft.targetLanguage, userLanguage: locale }),
          },
          {
            icon: "speaks",
            id: "nativeLanguage",
            label: t("You speak"),
            value: getLanguageName({ targetLanguage: nativeLanguage, userLanguage: locale }),
          },
        ]
      : [];
  };
}

function useDetailRows() {
  const t = useExtracted();

  return (draft: GoalDraft): UnderstoodRow[] => {
    const course = readText(draft.details, "targetCourse");
    const institution = readText(draft.details, "institution");
    const target = readText(draft.details, "targetScore");
    const position = readText(draft.details, "targetPosition");
    const reason = readText(draft.details, "reason");
    const role = readText(draft.details, "role");

    const rows: (UnderstoodRow | false)[] = [
      Boolean(course) && {
        editable: { key: "targetCourse", kind: "text" },
        icon: "course",
        id: "targetCourse",
        label: t("Course"),
        // A label, not "at {institution}": the preposition's article depends on the name ("na USP").
        note: institution ? t("Where: {institution}", { institution }) : undefined,
        value: course ?? "",
      },
      !course &&
        Boolean(institution) && {
          editable: { key: "institution", kind: "text" },
          icon: "course",
          id: "institution",
          label: t("Where"),
          value: institution ?? "",
        },
      Boolean(position) && {
        editable: { key: "targetPosition", kind: "text" },
        icon: "work",
        id: "targetPosition",
        label: t("Position"),
        value: position ?? "",
      },
      Boolean(target) && {
        editable: { key: "targetScore", kind: "text" },
        icon: "target",
        id: "targetScore",
        label: t("Target score"),
        note: t("It's your target. We help you prepare; nobody can promise a result."),
        value: target ?? "",
      },
      Boolean(reason) && {
        editable: { key: "reason", kind: "text" },
        icon: "reason",
        id: "reason",
        label: t("Reason"),
        value: reason ?? "",
      },
      Boolean(role) && {
        editable: { key: "role", kind: "text" },
        icon: "work",
        id: "role",
        label: t("Your role"),
        value: role ?? "",
      },
    ];

    return rows.filter((row) => row !== false);
  };
}

/**
 * The "Here's what I understood" rows for one goal, in the order the learner reads them: the
 * goal, its official dates with their source, the language, the target and why, the level they
 * gave and their deadline. Only what the words said shows up; everything else is asked later.
 */
export function useUnderstoodRows() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const examRow = useExamRow();
  const examYearRow = useExamYearRow();
  const languageRows = useLanguageRows();
  const detailRows = useDetailRows();

  return ({
    draft,
    examDates,
  }: {
    draft: GoalDraft;
    examDates: OnboardingExamDate[];
  }): UnderstoodRow[] => {
    const levelNote = readText(draft.details, "levelNote");
    const examYear = draft.kind === "exam" ? readExamYear({ dates: examDates, draft }) : null;

    const rows: (UnderstoodRow | null | false)[] = [
      {
        editable: { key: "title", kind: "text" },
        icon: "goal",
        id: "title",
        label: t("Goal"),
        value: draft.title,
      },
      examYearRow(examYear),
      // A day of their own replaces the official dates on the card.
      !draft.targetDate && examRow({ dates: examDates, year: examYear }),
      ...languageRows(draft),
      ...detailRows(draft),
      Boolean(levelNote) && {
        badge: t("you said"),
        icon: "level",
        id: "level",
        label: t("Level"),
        value: levelNote ?? "",
      },
      Boolean(draft.targetDate) && {
        editable: { key: "targetDate", kind: "date" },
        icon: "calendar",
        id: "targetDate",
        label: t("Deadline"),
        value: draft.targetDate ? formatDate(draft.targetDate, "short") : "",
      },
    ];

    return rows.filter((row): row is UnderstoodRow => Boolean(row));
  };
}

/**
 * When the learner studies, shared by every goal of the same onboarding: their words, or the
 * time they set here, and the minutes when they said them. The time can be fixed in place.
 */
export function useScheduleRow() {
  const t = useExtracted();
  const formatTime = useFormatTimeOfDay();

  return function toScheduleRow(
    schedule: UnderstoodSchedule,
    minutesSaid: boolean,
  ): UnderstoodRow | null {
    const when =
      schedule.studyTimeNote ?? (schedule.studyTime ? formatTime(schedule.studyTime) : null);

    const parts = [
      when,
      minutesSaid ? t("{minutes, number} min a day", { minutes: schedule.dailyMinutes }) : null,
    ].filter(Boolean);

    return parts.length > 0
      ? {
          editDefault: schedule.studyTime ?? "",
          editable: { key: "studyTime", kind: "time" },
          icon: "clock",
          id: "schedule",
          label: t("When you study"),
          value: parts.join(" · "),
        }
      : null;
  };
}
