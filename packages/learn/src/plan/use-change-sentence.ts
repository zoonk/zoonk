"use client";

import { type ExamDocument } from "@zoonk/core/exams/document";
import { type LanguageActivityType } from "@zoonk/core/language/activities";
import { NOTICE_SOURCE, PHASE_DATES_SOURCE } from "@zoonk/core/plans/change-contract";
import { type PlanOperation } from "@zoonk/core/plans/contract";
import { OWN_LEVEL_SOURCE } from "@zoonk/core/plans/own-level-contract";
import { type PlanChangeView, type PlanView } from "@zoonk/core/plans/view-contract";
import { REBALANCE_SOURCE } from "@zoonk/core/preparation/rebalance";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useFormatDuration } from "../_utils/time-format";
import { useNoticeDayText } from "./notice-day";
import { useActivityName } from "./plan-activities";
import { hasAreas, useAreaSentence } from "./use-area-sentence";
import { isChoiceOperation, useChoiceSentence } from "./use-choice-sentence";
import { useCoverageSentence } from "./use-coverage-sentence";
import { usePhaseDatesSentence } from "./use-phase-dates-sentence";
import { useShortList } from "./use-short-list";
import { type PlanChangeContent, useSystemChangeSentence } from "./use-system-change-sentence";
import { useToolSentence } from "./use-tool-sentence";
import { useWeekdaySentence } from "./use-weekday-texts";
import { useWrittenCadenceWords } from "./written-cadence";

type DifficultyBias = PlanView["steering"]["difficultyBias"];

export function useDifficultySentence() {
  const t = useExtracted();

  return (bias: DifficultyBias): string => {
    if (bias === "harder") {
      return t(
        "Harder from now on: tougher practice, and the basics you already do well are skipped.",
      );
    }

    return bias === "easier"
      ? t("Easier material from now on.")
      : t("Lessons at the usual difficulty from now on.");
  };
}

function useFollowsNoticeSentence() {
  const t = useExtracted();

  return (document: ExamDocument): string =>
    t(
      "{document, select, notice {Your plan follows the exam notice.} other {Your plan follows the exam's official guide.}}",
      { document },
    );
}

/** For a waiting change: "Daily time: 40 min.", never "changed to" before the learner said yes. */
function useProposedOperationSentence() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const formatDuration = useFormatDuration();

  return function proposedOperationSentence(operation: PlanOperation): string | null {
    if (operation.kind === "setDailyMinutes") {
      return t("Daily time: {time}.", { time: formatDuration(operation.minutes) });
    }

    if (operation.kind === "moveWeeklyEvent") {
      return t("Weekly challenge: {date}.", { date: formatDate(operation.to, "long") });
    }

    const date =
      (operation.kind === "setTargetDate" || operation.kind === "setNoticeDate") &&
      operation.targetDate;

    return date ? t("Goal date: {date}.", { date: formatDate(date, "long") }) : null;
  };
}

function useOperationSentence() {
  const t = useExtracted();
  const difficultySentence = useDifficultySentence();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();
  const list = (areas: string[]) => format.list(areas, { type: "conjunction" });
  const activityName = useActivityName();

  const activityList = (activities: LanguageActivityType[]) =>
    list(activities.map((activity) => activityName(activity)));

  const toolSentence = useToolSentence();
  const areaSentence = useAreaSentence();
  const weekdaySentence = useWeekdaySentence();
  const writtenCadence = useWrittenCadenceWords();
  const choiceSentence = useChoiceSentence();
  const formatDuration = useFormatDuration();
  const followsNotice = useFollowsNoticeSentence();
  const shortList = useShortList();

  return (operation: PlanOperation, document: ExamDocument): string => {
    if (hasAreas(operation)) {
      return areaSentence(operation);
    }

    if (isChoiceOperation(operation)) {
      return choiceSentence(operation);
    }

    switch (operation.kind) {
      case "setDailyMinutes":
        return t("Daily time changed to {time}.", { time: formatDuration(operation.minutes) });
      case "setWeekdayMinutes":
        return weekdaySentence(operation);
      case "addLightWeek":
        return t("A light week from {date}, at half the time.", {
          date: formatDate(operation.startDate, "long"),
        });
      case "moveWeeklyEvent":
        return t("The weekly challenge moved to {date}.", {
          date: formatDate(operation.to, "long"),
        });
      case "skipActivities":
        return t("{activities} left out of your lessons.", {
          activities: activityList(operation.activities),
        });
      case "restoreActivities":
        return t("{activities} back in your lessons.", {
          activities: activityList(operation.activities),
        });
      case "setPracticeBias":
        return operation.bias === "morePractice"
          ? t("More practice from now on.")
          : t("More explanation from now on.");
      case "setDifficultyBias":
        return difficultySentence(operation.bias);
      case "setWrittenCadence":
        return writtenCadence.changed(operation.cadence);
      case "addSkills":
        return t(
          "{count, plural, one {{skills} comes into your plan.} other {{skills} come into your plan.}}",
          {
            count: operation.skills.length,
            skills: shortList(
              operation.skills.map((skill) => skill.name),
              "topics",
            ),
          },
        );
      case "followNotice":
        return followsNotice(document);
      case "setNoticeDate":
        return t("Date moved to {date}.", { date: formatDate(operation.targetDate, "long") });
      case "setTools":
        return toolSentence(operation.tools);
      case "fitPhaseDates":
        return t("Your phase dates moved, so more lessons fit before your goal's date.");
      case "fitLessons":
        return t("The lessons your time fits come into your plan.");
      case "setExamChoice":
        return t("Your plan studies {subject} for {group}.", {
          group: operation.group,
          subject: operation.subject,
        });
      default:
        return t("Your plan changed.");
    }
  };
}

function useNoticeSentence() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const noticeDayText = useNoticeDayText();
  const followsNotice = useFollowsNoticeSentence();

  return ({
    examDocument: document,
    operations,
  }: Pick<PlanChangeView, "examDocument" | "operations">): string => {
    const follows = operations.some((operation) => operation.kind === "followNotice");
    const day = operations.find((operation) => operation.kind === "setNoticeDate");
    const date = day?.kind === "setNoticeDate" ? formatDate(day.targetDate, "long") : null;
    const estimated = day?.kind === "setNoticeDate" && day.estimated;

    if (follows && date) {
      return estimated
        ? t(
            "{document, select, notice {We read the exam notice: your plan can follow its subjects, with the exam around {date}.} other {We read the exam's official guide: your plan can follow its parts, with the exam around {date}.}}",
            { date, document },
          )
        : t(
            "{document, select, notice {We read the exam notice: your plan can follow its subjects, with the exam on {date}.} other {We read the exam's official guide: your plan can follow its parts, with the exam on {date}.}}",
            { date, document },
          );
    }

    if (follows) {
      return t(
        "{document, select, notice {We read the exam notice: your plan can follow its subjects and topics.} other {We read the exam's official guide: your plan can follow its parts and topics.}}",
        { document },
      );
    }

    if (day?.kind === "setNoticeDate") {
      return noticeDayText({ date: day.targetDate, document, estimated: day.estimated });
    }

    return followsNotice(document);
  };
}

export function useAppliedLine() {
  const t = useExtracted();

  return (todaySession: PlanChangeView["todaySession"]): string => {
    if (todaySession === "changed") {
      return t("It's in your plan, and today's session follows it.");
    }

    if (todaySession === "unchanged") {
      return t("It's in your plan from your next study day. Today's session stays as it is.");
    }

    return t("Your plan follows it from now on.");
  };
}

export function useChangeSentence({ targetDate = null }: { targetDate?: string | null } = {}) {
  const t = useExtracted();
  const format = useFormatter();
  const shortList = useShortList();
  const operationSentence = useOperationSentence();
  const proposedSentence = useProposedOperationSentence();
  const noticeSentence = useNoticeSentence();
  const coverageSentence = useCoverageSentence();
  const systemSentence = useSystemChangeSentence({ targetDate });
  const phaseDatesSentence = usePhaseDatesSentence();

  return (change: PlanChangeContent): string => {
    if (change.reason) {
      return change.reason;
    }

    if (change.source === NOTICE_SOURCE) {
      return noticeSentence(change);
    }

    if (change.source === PHASE_DATES_SOURCE && change.status === "proposed") {
      return phaseDatesSentence(change.effect);
    }

    const [first] = change.operations;

    if (change.source === OWN_LEVEL_SOURCE && first?.kind === "addSkills") {
      return t("For your new level, these come first: {skills}.", {
        skills: shortList(
          first.skills.map((skill) => skill.name),
          "topics",
        ),
      });
    }

    if (change.source === REBALANCE_SOURCE && first?.kind === "focusAreas") {
      return t("More time for {areas}, where it's needed most.", {
        areas: format.list(first.areas, { type: "conjunction" }),
      });
    }

    return (
      systemSentence(change) ??
      (change.operations.length > 0
        ? change.operations
            .map(
              (operation) =>
                (change.status === "proposed" && proposedSentence(operation)) ||
                operationSentence(operation, change.examDocument),
            )
            .join(" ")
        : coverageSentence(change))
    );
  };
}

export function useOfficialDateLine() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function officialDateLine(
    change: Pick<PlanChangeView, "examDocument" | "officialDate" | "status">,
  ): string | null {
    return change.status === "proposed" && change.officialDate
      ? t(
          "{document, select, notice {The exam notice sets the exam for {date}.} other {The exam's official calendar sets the exam for {date}.}}",
          { date: formatDate(change.officialDate.date, "long"), document: change.examDocument },
        )
      : null;
  };
}

export function useKeepOfficialDateLabel() {
  const t = useExtracted();

  return (document: ExamDocument): string =>
    t("{document, select, notice {Keep the notice's date} other {Keep the official date}}", {
      document,
    });
}
