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

/**
 * A fact the learner can fix in place: the goal's title and date, one of its details, or when they
 * study (shared by every goal of the onboarding).
 */
export type EditableField =
  | { kind: "date"; key: "targetDate" }
  | {
      kind: "text";
      key: "institution" | "reason" | "role" | "targetCourse" | "targetPosition" | "targetScore";
    }
  | { kind: "text"; key: "title" }
  | { kind: "time"; key: "studyTime" };

export type UnderstoodRow = {
  /** A small marker next to the value, such as "you said" for a level. */
  badge?: string;
  /** Dates the learner picks the row's date from with one tap (an exam's next sittings). */
  choiceDates?: string[];
  editable?: EditableField;
  /** What the editor starts from when the field is still empty, such as the exam's first day. */
  editDefault?: string;
  /** What the row is called while it's being fixed, when that's one of its facts (one date). */
  editLabel?: string;
  id: string;
  label: string;
  note?: string;
  source?: { title: string | null; url: string } | null;
  /** The notice's day, when it isn't the date the row shows: taken with one tap. */
  suggestedDate?: string;
  value: string;
};

/** What a goal (a draft, or one already created) says of itself, as its rows read it. */
type GoalFacts = Pick<GoalDraft, "kind" | "language" | "title"> & {
  details?: Record<string, unknown> | null;
  targetLanguage?: string | null;
};

function readText(details: GoalFacts["details"], key: string): string | null {
  const value = details?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

/** A language goal's language, unless its title says it, and the one the learner speaks. */
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

/**
 * The target's last cut-off, under the target, when another learner's research already found it:
 * where the bar was, with its source, so a target can be fixed right here. Never a promise.
 */
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

/**
 * The goal's course or where, its target, the last cut-off, why, and the learner's role, each once:
 * what the title already says isn't repeated. Shared by "Here's what I understood" and the plan
 * so far beside the questions, which shows each as the answers fill it in.
 */
export function useDetailRows() {
  const t = useExtracted();
  const cutoffRow = useCutoffRow();

  return (draft: GoalFacts, cutoff: TargetCutoff | null): UnderstoodRow[] => {
    /** A detail the title already says isn't repeated: fixing the title fixes it. */
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
    // A career change names where they're coming from and where they're going, not "their role".
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
        // A language goal aims for a level ("B2"), which the Plan shows next to the learner's.
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

/**
 * The "Here's what I understood" rows for one goal, in the order the learner reads them: the
 * goal, its one date, the language, the target and why, and the level they gave. Each fact shows
 * once: what the goal's title already says gets no row of its own. Only what the words said shows
 * up; everything else is asked later.
 */
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

/**
 * When the learner studies, shared by every goal of the same onboarding: their words, or the
 * time they set here, and the minutes when they said them. The time can be fixed in place.
 */
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

/**
 * The material the learner attached to the goal, so they see it was taken in: the plan, its
 * lessons and its practice follow it. Null without material.
 */
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
