"use client";

import { type TargetCutoff } from "@zoonk/core/exams/cutoffs/contract";
import { type GoalDraft } from "@zoonk/core/goals/contract";
import {
  type OnboardingExamDate,
  type UnderstoodSchedule,
} from "@zoonk/core/view-models/onboarding/contract";
import { getLanguageName } from "@zoonk/utils/languages";
import { useExtracted, useLocale } from "next-intl";
import { useFormatDuration, useFormatTimeOfDay } from "../../_utils/time-format";
import { useCutoffWords } from "../../exam/target-cutoff";
import { isSaidInTitle } from "./said-in-title";
import { useDateRow } from "./understood-date-row";

export type EditableField =
  | { kind: "date"; key: "targetDate" }
  | {
      kind: "text";
      key: "institution" | "reason" | "role" | "targetCourse" | "targetPosition" | "targetScore";
    }
  | { kind: "text"; key: "title" }
  | { kind: "time"; key: "studyTime" };

export type UnderstoodRow = {
  badge?: string;
  choiceDates?: string[];
  editable?: EditableField;
  editDefault?: string;
  editLabel?: string;
  id: string;
  label: string;
  note?: string;
  source?: { title: string | null; url: string } | null;
  suggestedDate?: string;
  value: string;
};

type GoalFacts = Pick<GoalDraft, "kind" | "language" | "title"> & {
  details?: Record<string, unknown> | null;
  targetLanguage?: string | null;
};

function readText(details: GoalFacts["details"], key: string): string | null {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export function useLanguageRows() {
  const t = useExtracted();
  const locale = useLocale();

  return (draft: GoalFacts): UnderstoodRow[] => {
    if (draft.kind !== "language" || !draft.targetLanguage) {
      return [];
    }

    const nativeLanguage = readText(draft.details, "nativeLanguage") ?? draft.language;

    const language = getLanguageName({
      targetLanguage: draft.targetLanguage,
      userLanguage: locale,
    });

    const rows: (UnderstoodRow | false)[] = [
      !isSaidInTitle({ title: draft.title, value: language }) && {
        id: "targetLanguage",
        label: t("Language"),
        value: language,
      },
      {
        id: "nativeLanguage",
        label: t("You speak"),
        value: getLanguageName({ targetLanguage: nativeLanguage, userLanguage: locale }),
      },
    ];

    return rows.filter((row) => row !== false);
  };
}

function useCutoffRow() {
  const t = useExtracted();
  const words = useCutoffWords();

  return (cutoff: TargetCutoff | null): UnderstoodRow | null =>
    cutoff && {
      id: "cutoff",
      label: t("Last cut-off"),
      note: words.detail(cutoff),
      // Named by its site: a search's page titles are often file names ("Notas-minimas.pdf").
      source: { title: null, url: cutoff.source.url },
      value: words.score(cutoff),
    };
}

export function useDetailRows() {
  const t = useExtracted();
  const cutoffRow = useCutoffRow();

  return (draft: GoalFacts, cutoff: TargetCutoff | null): UnderstoodRow[] => {
    const unsaid = (key: string) => {
      const value = readText(draft.details, key);
      return value && !isSaidInTitle({ title: draft.title, value }) ? value : null;
    };

    const course = unsaid("targetCourse");
    const institution = unsaid("institution");
    const target = unsaid("targetScore");
    const position = unsaid("targetPosition");
    const reason = unsaid("reason");
    const role = unsaid("role");
    const isCareerChange = draft.details?.purpose === "careerChange";

    const rows: (UnderstoodRow | false)[] = [
      Boolean(course) && {
        editable: { key: "targetCourse", kind: "text" },
        id: "targetCourse",
        label: t("Course"),
        // A label, not "at {institution}": the preposition's article depends on the name ("na USP").
        note: institution ? t("Where: {institution}", { institution }) : undefined,
        value: course ?? "",
      },
      !course &&
        Boolean(institution) && {
          editable: { key: "institution", kind: "text" },
          id: "institution",
          label: t("Where"),
          value: institution ?? "",
        },
      Boolean(position) && {
        editable: { key: "targetPosition", kind: "text" },
        id: "targetPosition",
        label: isCareerChange ? t("The role you want") : t("Position"),
        value: position ?? "",
      },
      Boolean(target) && {
        editable: { key: "targetScore", kind: "text" },
        id: "targetScore",
        label: draft.kind === "language" ? t("Level you're aiming for") : t("Target score"),
        value: target ?? "",
      },
      cutoffRow(cutoff) ?? false,
      Boolean(reason) && {
        editable: { key: "reason", kind: "text" },
        id: "reason",
        label: t("Reason"),
        value: reason ?? "",
      },
      Boolean(role) && {
        editable: { key: "role", kind: "text" },
        id: "role",
        label: isCareerChange ? t("What you do now") : t("Your role"),
        value: role ?? "",
      },
    ];

    return rows.filter((row) => row !== false);
  };
}

export function useUnderstoodRows() {
  const t = useExtracted();
  const dateRow = useDateRow();
  const languageRows = useLanguageRows();
  const detailRows = useDetailRows();

  return ({
    cutoff,
    draft,
    examDates,
  }: {
    cutoff: TargetCutoff | null;
    draft: GoalDraft;
    examDates: OnboardingExamDate[];
  }): UnderstoodRow[] => {
    const levelNote = readText(draft.details, "levelNote");

    const rows: (UnderstoodRow | null | false)[] = [
      {
        editable: { key: "title", kind: "text" },
        id: "title",
        label: t("Goal"),
        value: draft.title,
      },
      dateRow({ draft, examDates }),
      ...languageRows(draft),
      ...detailRows(draft, cutoff),
      Boolean(levelNote) && {
        badge: t("you said"),
        id: "level",
        label: t("Level"),
        value: levelNote ?? "",
      },
    ];

    return rows.filter((row): row is UnderstoodRow => Boolean(row));
  };
}

export function useScheduleRow() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const formatTime = useFormatTimeOfDay();

  return function toScheduleRow(
    schedule: UnderstoodSchedule,
    minutesSaid: boolean,
  ): UnderstoodRow | null {
    const when =
      schedule.studyTimeNote ?? (schedule.studyTime ? formatTime(schedule.studyTime) : null);

    const parts = [
      when,
      minutesSaid ? t("{time} a day", { time: formatDuration(schedule.dailyMinutes) }) : null,
    ].filter(Boolean);

    return parts.length > 0
      ? {
          editDefault: schedule.studyTime ?? "",
          editable: { key: "studyTime", kind: "time" },
          id: "schedule",
          label: t("When you study"),
          value: parts.join(" · "),
        }
      : null;
  };
}

export function useMaterialRow() {
  const t = useExtracted();

  return function toMaterialRow(material: readonly { title: string }[]): UnderstoodRow | null {
    if (material.length === 0) {
      return null;
    }

    return {
      id: "material",
      label: t("Your material"),
      note: t("Your plan and lessons follow this material"),
      value: material.map((source) => source.title || t("Your text")).join(", "),
    };
  };
}
