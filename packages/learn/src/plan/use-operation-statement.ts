"use client";

import { type ExamDocument } from "@zoonk/core/exams/document";
import { type PlanOperation } from "@zoonk/core/plans/contract";
import { type PlanView } from "@zoonk/core/plans/view-contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { toLabelCase } from "../_utils/label-case";
import { useFormatDuration } from "../_utils/time-format";
import { useFormatWeekday } from "../_utils/use-format-weekday";
import { type GoalDateKind } from "./goal-date-kind";
import { useActivityNames, useAreaNames } from "./use-operation-names";
import { useShortList } from "./use-short-list";
import { useToolSentence } from "./use-tool-sentence";
import { useWrittenCadenceWords } from "./written-cadence";

type DifficultyBias = PlanView["steering"]["difficultyBias"];

function useDifficultySentence() {
  const t = useExtracted();

  return (bias: DifficultyBias): string => {
    if (bias === "harder") {
      return t("Harder lessons from now on.");
    }

    return bias === "easier"
      ? t("Easier lessons from now on.")
      : t("Lessons at the usual difficulty from now on.");
  };
}

export function useFollowsGuideSentence() {
  const t = useExtracted();

  return (document: ExamDocument): string =>
    t({
      description:
        'In the "notice" form the document is the exam\'s public notice (Brazil\'s "edital"); otherwise it is an official guide.',
      message:
        "{document, select, notice {Your plan follows the exam's official guide.} other {Your plan follows the exam's official guide.}}",
      values: { document },
    });
}

function useAreaStatement() {
  const t = useExtracted();
  const areaNames = useAreaNames();
  const shortList = useShortList();

  return function areaStatement(operation: PlanOperation): string | null {
    if (operation.kind === "addSkills") {
      return t(
        "{count, plural, one {{topics} added to your plan.} other {{topics} added to your plan.}}",
        {
          count: operation.skills.length,
          topics: shortList(
            operation.skills.map((skill) => skill.name),
            "topics",
          ),
        },
      );
    }

    if (!("areas" in operation)) {
      return null;
    }

    const count = operation.areas.length;

    const subjects = areaNames(operation);

    switch (operation.kind) {
      case "focusAreas":
        return count > 0
          ? t("Your focus: {subjects}.", { subjects })
          : t("Your plan has no focus.");
      case "reduceAreas":
        return t("Less time for {subjects}.", { subjects });
      case "skipAreas":
        return t(
          "{count, plural, one {{subjects} isn't in your plan.} other {{subjects} aren't in your plan.}}",
          { count, subjects },
        );
      case "restoreAreas":
        return t(
          "{count, plural, one {{subjects} added to your plan.} other {{subjects} added to your plan.}}",
          { count, subjects },
        );
      case "setAreaStart":
        return operation.start === "pastBasics"
          ? t("Your plan skips the basics of {subjects}.", { subjects })
          : t(
              "{count, plural, one {{subjects} starts from the basics.} other {{subjects} start from the basics.}}",
              { count, subjects },
            );
      default:
        return operation satisfies never;
    }
  };
}

type BaseChoices = Extract<PlanOperation, { kind: "setBaseChoices" }>["choices"];

function useBaseChoicesStatement() {
  const t = useExtracted();
  const format = useFormatter();

  return (choices: BaseChoices): string => {
    const count = (choice: BaseChoices[number]["choice"]) =>
      choices.filter((entry) => entry.choice === choice).length;

    const parts = [
      count("deep") > 0 &&
        t("{count, plural, one {# with every lesson} other {# with every lesson}}", {
          count: count("deep"),
        }),
      count("essential") > 0 &&
        t(
          "{count, plural, one {# with the first lessons only} other {# with the first lessons only}}",
          { count: count("essential") },
        ),
      count("quick") > 0 &&
        t("{count, plural, one {# with one short lesson} other {# with one short lesson}}", {
          count: count("quick"),
        }),
      count("skip") > 0 &&
        t("{count, plural, one {# skipped} other {# skipped}}", { count: count("skip") }),
    ].filter((part) => typeof part === "string");

    return t("Prerequisites: {parts}.", { parts: format.list(parts, { type: "conjunction" }) });
  };
}

function useTimeStatement() {
  const t = useExtracted();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();
  const formatDuration = useFormatDuration();
  const formatWeekday = useFormatWeekday();

  return function timeStatement(operation: PlanOperation): string | null {
    if (operation.kind === "setDailyMinutes") {
      return t("You now study {time} a day.", { time: formatDuration(operation.minutes) });
    }

    if (operation.kind === "setWeekdayMinutes") {
      const days = toLabelCase(
        format.list(
          operation.weekdays.map((weekday) => formatWeekday(weekday)),
          { type: "conjunction" },
        ),
      );

      return operation.minutes === 0
        ? t("{days}: rest day.", { days })
        : t("{days}: {time} a day.", { days, time: formatDuration(operation.minutes) });
    }

    if (operation.kind === "addLightWeek") {
      return t("A lighter week from {date}, at half the time.", {
        date: formatDate(operation.startDate, "long"),
      });
    }

    return operation.kind === "moveWeeklyEvent"
      ? t("This week's challenge moved to {date}.", { date: formatDate(operation.to, "long") })
      : null;
  };
}

function useDateStatement() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function dateStatement(operation: PlanOperation, dateKind: GoalDateKind): string | null {
    if (operation.kind === "setTargetDate" || operation.kind === "setNoticeDate") {
      return operation.targetDate
        ? t(
            "{dateKind, select, exam {Exam date: {date}.} goal {End date: {date}.} other {Date moved to {date}.}}",
            { date: formatDate(operation.targetDate, "long"), dateKind },
          )
        : t("Your plan has no end date.");
    }

    if (operation.kind === "setFullCourse") {
      return operation.fullCourse
        ? t("Your plan goes on after the exam.")
        : t("Your plan ends at the exam.");
    }

    return null;
  };
}

function useLessonsStatement() {
  const t = useExtracted();
  const activityNames = useActivityNames();
  const difficultySentence = useDifficultySentence();

  return function lessonsStatement(operation: PlanOperation): string | null {
    if (operation.kind === "skipActivities" || operation.kind === "restoreActivities") {
      const activities = activityNames(operation);

      return operation.kind === "skipActivities"
        ? t("Your lessons no longer have {activities}.", { activities })
        : t("{activities} back in your lessons.", { activities });
    }

    if (operation.kind === "setPracticeBias") {
      return operation.bias === "morePractice"
        ? t("More practice from now on.")
        : t("More explanation from now on.");
    }

    return operation.kind === "setDifficultyBias" ? difficultySentence(operation.bias) : null;
  };
}

function useSettingStatement() {
  const t = useExtracted();
  const format = useFormatter();
  const baseChoicesStatement = useBaseChoicesStatement();
  const writtenCadence = useWrittenCadenceWords();
  const toolSentence = useToolSentence();

  return function settingStatement(operation: PlanOperation): string | null {
    if (operation.kind === "setBaseChoices") {
      return baseChoicesStatement(operation.choices);
    }

    if (operation.kind === "setAim") {
      return t("Level to reach: {level}.", { level: operation.aim });
    }

    if (operation.kind === "setWrittenCadence") {
      return writtenCadence.changed(operation.cadence);
    }

    if (operation.kind === "setTools") {
      return toolSentence(operation.tools);
    }

    if (operation.kind === "fitLessons") {
      return t("Lessons added to your plan.");
    }

    if (operation.kind === "fitPhaseDates") {
      return t("Your phase dates moved.");
    }

    return operation.kind === "setExamChoice"
      ? t("{group}: {subject}.", {
          group: operation.group,
          subject: format.list(operation.subjects, { type: "conjunction" }),
        })
      : null;
  };
}

/** What a change did, once it's in the plan. */
export function useOperationStatement() {
  const t = useExtracted();
  const areaStatement = useAreaStatement();
  const timeStatement = useTimeStatement();
  const dateStatement = useDateStatement();
  const lessonsStatement = useLessonsStatement();
  const settingStatement = useSettingStatement();
  const followsGuide = useFollowsGuideSentence();

  return function operationStatement({
    dateKind,
    document,
    operation,
  }: {
    dateKind: GoalDateKind;
    document: ExamDocument;
    operation: PlanOperation;
  }): string {
    return (
      areaStatement(operation) ??
      timeStatement(operation) ??
      dateStatement(operation, dateKind) ??
      lessonsStatement(operation) ??
      settingStatement(operation) ??
      (operation.kind === "followNotice" ? followsGuide(document) : t("Your plan changed."))
    );
  };
}
