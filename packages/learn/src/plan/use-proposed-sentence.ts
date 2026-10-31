"use client";

import { type PlanOperation } from "@zoonk/core/plans/contract";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { useActivityName } from "./plan-activities";
import { useShortList } from "./use-short-list";

function useProposedListSentence() {
  const t = useExtracted();
  const format = useFormatter();
  const activityName = useActivityName();
  const shortList = useShortList();
  const list = (items: string[]) => format.list(items, { type: "conjunction" });

  return function proposedListSentence(operation: PlanOperation): string | null {
    if (operation.kind === "skipActivities" || operation.kind === "restoreActivities") {
      const activities = list(operation.activities.map((activity) => activityName(activity)));

      return operation.kind === "skipActivities"
        ? t("Leave out: {activities}.", { activities })
        : t("Back in your lessons: {activities}.", { activities });
    }

    if (operation.kind === "skipAreas") {
      return t("Leave out of the plan: {areas}.", { areas: list(operation.areas) });
    }

    if (operation.kind === "restoreAreas") {
      return t("Back in the plan: {areas}.", { areas: list(operation.areas) });
    }

    if (operation.kind === "addSkills") {
      const skills = shortList(
        operation.skills.map((skill) => skill.name),
        "topics",
      );

      return t("Add to your plan: {skills}.", { skills });
    }

    return null;
  };
}

function useProposedSettingSentence() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatDuration = useFormatDuration();

  return function proposedSettingSentence(operation: PlanOperation): string | null {
    if (operation.kind === "setDailyMinutes") {
      return t("Daily time: {time}.", { time: formatDuration(operation.minutes) });
    }

    if (operation.kind === "moveWeeklyEvent") {
      return t("Weekly challenge: {date}.", { date: formatDate(operation.to, "long") });
    }

    if (operation.kind === "setPracticeBias") {
      return operation.bias === "morePractice" ? t("More practice.") : t("More explanation.");
    }

    if (operation.kind === "setDifficultyBias") {
      if (operation.bias === "harder") {
        return t("Harder material.");
      }

      return operation.bias === "easier"
        ? t("Easier material.")
        : t("Lessons at the usual difficulty.");
    }

    const date =
      (operation.kind === "setTargetDate" || operation.kind === "setNoticeDate") &&
      operation.targetDate;

    return date ? t("Goal date: {date}.", { date: formatDate(date, "long") }) : null;
  };
}

/** For a change never applied: "Daily time: 40 min.", never "changed to" unless the learner said yes. */
export function useProposedOperationSentence() {
  const listSentence = useProposedListSentence();
  const settingSentence = useProposedSettingSentence();

  return (operation: PlanOperation): string | null =>
    listSentence(operation) ?? settingSentence(operation);
}
