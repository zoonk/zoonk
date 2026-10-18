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

/**
 * What a difficulty setting does, the same where it's changed and where the change is announced:
 * harder also skips the basics of what the learner already does well.
 */
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

/**
 * "Your plan follows the exam notice.": what a change that brings the notice's subjects in did, or
 * a language certificate's official guide (see `ExamDocument`).
 */
function useFollowsNoticeSentence() {
  const t = useExtracted();

  return (document: ExamDocument): string =>
    t(
      "{document, select, notice {Your plan follows the exam notice.} other {Your plan follows the exam's official guide.}}",
      { document },
    );
}

/**
 * Says what a waiting change sets where its sentence would say it happened ("Daily time changed to
 * 40 min."): "Daily time: 40 min." The buddy's card read "Daily time changed to 40 min." before
 * Marcos had said yes. Null for an operation whose sentence holds before and after.
 */
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

/** Says one operation the way the learner would: "Light week from Oct 12". */
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

/**
 * What the exam's notice changes, said once: its subjects when research read it after the plan
 * was built, and its exam day when it isn't the plan's date. A language certificate's are its
 * official guide's (see `ExamDocument`).
 */
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

/**
 * What an applied change did, said where its buttons were: today's session follows it, or it
 * starts on the next study day because today's is underway; with no session built for today yet,
 * the plan follows it from now on. The buddy's cards and Today's notice say it the same way.
 */
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

/**
 * The one sentence that announces a change. Proposals and AI edits carry their own sentence;
 * the app says the rest from what changed, so nothing is ever silent.
 */
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

    // A lower level of your own brings in foundations: they say what comes first now.
    if (change.source === OWN_LEVEL_SOURCE && first?.kind === "addSkills") {
      return t("For your new level, these come first: {skills}.", {
        skills: shortList(
          first.skills.map((skill) => skill.name),
          "topics",
        ),
      });
    }

    // A rebalance after a session says why: time went to the area that needs it most.
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

/**
 * "The exam notice sets the exam for January 10, 2027." for a waiting change that moves an exam off
 * the day its notice sets (a language certificate's official calendar): said with the change, so
 * the learner keeps their own date only on purpose. Null otherwise.
 */
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

/**
 * "Keep the notice's date": declining a change that moves the exam off its official day keeps that
 * day, said the same on Today and in the buddy's card (a language certificate's official date).
 */
export function useKeepOfficialDateLabel() {
  const t = useExtracted();

  return (document: ExamDocument): string =>
    t("{document, select, notice {Keep the notice's date} other {Keep the official date}}", {
      document,
    });
}
