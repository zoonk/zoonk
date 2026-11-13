"use client";

import { type PlanOperation } from "@zoonk/core/plans/contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { useFormatWeekday } from "../_utils/use-format-weekday";
import { type GoalDateKind } from "./goal-date-kind";
import { useActivityName } from "./plan-activities";
import { useShortList } from "./use-short-list";

function useAreaQuestion() {
  const t = useExtracted();
  const format = useFormatter();
  const shortList = useShortList();

  return function areaQuestion(operation: PlanOperation): string | null {
    if (operation.kind === "addSkills") {
      return t("Add {topics} to your plan?", {
        topics: shortList(
          operation.skills.map((skill) => skill.name),
          "topics",
        ),
      });
    }

    if (!("areas" in operation)) {
      return null;
    }

    const parts = operation.kind === "focusAreas" ? (operation.parts ?? []) : [];

    const subjects = format.list(
      operation.areas.map((area) => parts.find((part) => part.area === area)?.name ?? area),
      { type: "conjunction" },
    );

    switch (operation.kind) {
      case "focusAreas":
        return operation.areas.length > 0
          ? t("Focus on {subjects}?", { subjects })
          : t("Remove your focus?");
      case "reduceAreas":
        return t("Less time for {subjects}?", { subjects });
      case "skipAreas":
        return t("Take {subjects} out of your plan?", { subjects });
      case "restoreAreas":
        return t("Add {subjects} back to your plan?", { subjects });
      case "setAreaStart":
        return operation.start === "pastBasics"
          ? t("Skip the basics of {subjects}?", { subjects })
          : t("Start {subjects} from the basics?", { subjects });
      default:
        return operation satisfies never;
    }
  };
}

function useTimeQuestion() {
  const t = useExtracted();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();
  const formatDuration = useFormatDuration();
  const formatWeekday = useFormatWeekday();

  return function timeQuestion(operation: PlanOperation): string | null {
    if (operation.kind === "setDailyMinutes") {
      return t("Study {time} a day?", { time: formatDuration(operation.minutes) });
    }

    if (operation.kind === "setWeekdayMinutes") {
      const days = format.list(
        operation.weekdays.map((weekday) => formatWeekday(weekday)),
        { type: "conjunction" },
      );

      return operation.minutes === 0
        ? t("{count, plural, one {Make {days} a rest day?} other {Make {days} rest days?}}", {
            count: operation.weekdays.length,
            days,
          })
        : t("Study {time} on {days}?", { days, time: formatDuration(operation.minutes) });
    }

    if (operation.kind === "addLightWeek") {
      return t("Take a lighter week from {date}, at half the time?", {
        date: formatDate(operation.startDate, "long"),
      });
    }

    return operation.kind === "moveWeeklyEvent"
      ? t("Move this week's challenge to {date}?", { date: formatDate(operation.to, "long") })
      : null;
  };
}

function useDateQuestion() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function dateQuestion(operation: PlanOperation, dateKind: GoalDateKind): string | null {
    if (operation.kind === "setTargetDate" || operation.kind === "setNoticeDate") {
      return operation.targetDate
        ? t(
            "{dateKind, select, exam {Move your exam date to {date}?} goal {Move your end date to {date}?} other {Move your date to {date}?}}",
            { date: formatDate(operation.targetDate, "long"), dateKind },
          )
        : t("Study without an end date?");
    }

    if (operation.kind === "setFullCourse") {
      return operation.fullCourse
        ? t("Keep studying after the exam?")
        : t("End your plan at the exam?");
    }

    return null;
  };
}

function useDifficultyQuestion() {
  const t = useExtracted();

  return function difficultyQuestion(operation: PlanOperation): string | null {
    if (operation.kind === "setPracticeBias") {
      return operation.bias === "morePractice" ? t("More practice?") : t("More explanation?");
    }

    if (operation.kind !== "setDifficultyBias") {
      return null;
    }

    if (operation.bias === "harder") {
      return t("Harder lessons?");
    }

    return operation.bias === "easier" ? t("Easier lessons?") : t("Back to the usual difficulty?");
  };
}

function useLessonsQuestion() {
  const t = useExtracted();
  const format = useFormatter();
  const activityName = useActivityName();

  return function lessonsQuestion(operation: PlanOperation): string | null {
    if (operation.kind === "skipActivities" || operation.kind === "restoreActivities") {
      const activities = format.list(
        operation.activities.map((activity) => activityName(activity)),
        { type: "conjunction" },
      );

      return operation.kind === "skipActivities"
        ? t("Take {activities} out of your lessons?", { activities })
        : t("Bring {activities} back to your lessons?", { activities });
    }

    if (operation.kind === "setBaseChoices") {
      return t("Change your prerequisites?");
    }

    if (operation.kind === "setAim") {
      return t("Study up to {level}?", { level: operation.aim });
    }

    return operation.kind === "fitLessons" ? t("Add the lessons your time fits?") : null;
  };
}

/** A change nobody applied yet is a question; null when the operation has no question of its own. */
export function useOperationQuestion() {
  const areaQuestion = useAreaQuestion();
  const timeQuestion = useTimeQuestion();
  const dateQuestion = useDateQuestion();
  const difficultyQuestion = useDifficultyQuestion();
  const lessonsQuestion = useLessonsQuestion();

  return function operationQuestion(
    operation: PlanOperation,
    dateKind: GoalDateKind,
  ): string | null {
    return (
      areaQuestion(operation) ??
      timeQuestion(operation) ??
      dateQuestion(operation, dateKind) ??
      difficultyQuestion(operation) ??
      lessonsQuestion(operation)
    );
  };
}
