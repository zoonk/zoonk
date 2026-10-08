"use client";

import { type LanguageActivityType } from "@zoonk/core/language/activities";
import { NOTICE_SOURCE } from "@zoonk/core/plans/change-contract";
import { type PlanOperation } from "@zoonk/core/plans/contract";
import { OWN_LEVEL_SOURCE } from "@zoonk/core/plans/own-level-contract";
import { type PlanChangeView, type PlanView } from "@zoonk/core/plans/view-contract";
import { REBALANCE_SOURCE } from "@zoonk/core/preparation/rebalance";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useActivityName } from "./plan-activities";
import { hasAreas, useAreaSentence } from "./use-area-sentence";
import { useAreaStartTexts } from "./use-area-start-texts";
import { useLessonsEffectText, useTopicsEffectText } from "./use-effect-counts";
import { useToolSentence } from "./use-tool-sentence";
import { useWeekdaySentence, useWeeklyEventsText } from "./use-weekday-texts";
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

  return (operation: PlanOperation): string => {
    if (hasAreas(operation)) {
      return areaSentence(operation);
    }

    switch (operation.kind) {
      case "setDailyMinutes":
        return t("Daily time changed to {minutes, number} min.", { minutes: operation.minutes });
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
      case "setTargetDate":
        return operation.targetDate
          ? t("Date moved to {date}.", { date: formatDate(operation.targetDate, "long") })
          : t("Date removed.");
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
            skills: list(operation.skills.map((skill) => skill.name)),
          },
        );
      case "followNotice":
        return t("Your plan follows the exam notice.");
      case "setNoticeDate":
        return t("Date moved to {date}.", { date: formatDate(operation.targetDate, "long") });
      case "setTools":
        return toolSentence(operation.tools);
      default:
        return t("Your plan changed.");
    }
  };
}

/**
 * What the exam's notice changes, said once: its subjects when research read it after the plan
 * was built, and its exam day when it isn't the plan's date.
 */
function useNoticeSentence() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return (operations: PlanOperation[]): string => {
    const followsNotice = operations.some((operation) => operation.kind === "followNotice");
    const day = operations.find((operation) => operation.kind === "setNoticeDate");
    const date = day?.kind === "setNoticeDate" ? formatDate(day.targetDate, "long") : null;
    const estimated = day?.kind === "setNoticeDate" && day.estimated;

    if (followsNotice && date) {
      return estimated
        ? t(
            "We read the exam notice: your plan can follow its subjects, with the exam around {date}.",
            { date },
          )
        : t(
            "We read the exam notice: your plan can follow its subjects, with the exam on {date}.",
            { date },
          );
    }

    if (followsNotice) {
      return t("We read the exam notice: your plan can follow its subjects and topics.");
    }

    if (date) {
      return estimated
        ? t("The exam's likely date is now {date}, until its notice is out.", { date })
        : t("The exam notice puts the exam on {date}.", { date });
    }

    return t("Your plan follows the exam notice.");
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
export function useChangeSentence() {
  const t = useExtracted();
  const format = useFormatter();
  const operationSentence = useOperationSentence();
  const noticeSentence = useNoticeSentence();

  return (change: PlanChangeView): string => {
    if (change.reason) {
      return change.reason;
    }

    if (change.source === NOTICE_SOURCE) {
      return noticeSentence(change.operations);
    }

    const [first] = change.operations;

    // A lower level of your own brings in foundations: they say what comes first now.
    if (change.source === OWN_LEVEL_SOURCE && first?.kind === "addSkills") {
      return t("For your new level, these come first: {skills}.", {
        skills: format.list(
          first.skills.map((skill) => skill.name),
          { type: "conjunction" },
        ),
      });
    }

    // A rebalance after a session says why: time went to the area that needs it most.
    if (change.source === REBALANCE_SOURCE && first?.kind === "focusAreas") {
      return t("More time for {areas}, where it's needed most.", {
        areas: format.list(first.areas, { type: "conjunction" }),
      });
    }

    switch (change.kind) {
      case "missedDays":
        return t("Lessons earlier days left come first, and the rest of your plan moved forward.");
      case "estimateUpdated":
        return t("Your plan got more precise as you studied.");
      case "testedOut":
        return t(
          "{lessons, plural, one {You tested out of # lesson} other {You tested out of # lessons}}, so it's off your plan.",
          { lessons: change.lessonsSkipped },
        );
      default:
        return change.operations.length > 0
          ? change.operations.map((operation) => operationSentence(operation)).join(" ")
          : t("Your plan changed.");
    }
  };
}

/**
 * "The exam notice sets the exam for January 10, 2027." for a waiting change that moves an exam off
 * the day its notice sets: said with the change, so the learner keeps their own date only on
 * purpose. Null otherwise.
 */
export function useOfficialDateLine() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function officialDateLine(
    change: Pick<PlanChangeView, "officialDate" | "status">,
  ): string | null {
    return change.status === "proposed" && change.officialDate
      ? t("The exam notice sets the exam for {date}.", {
          date: formatDate(change.officialDate.date, "long"),
        })
      : null;
  };
}

/** How a change moves the end: "Ends Nov 20 instead of Nov 12". Null when the end stays. */
function useChangeEffectText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function effectText(change: Pick<PlanChangeView, "effect">): string | null {
    const { effect } = change;

    if (!effect?.endDateAfter || !effect.endDateBefore) {
      return null;
    }

    if (effect.endDateAfter === effect.endDateBefore) {
      return null;
    }

    return t("Ends {after} instead of {before}.", {
      after: formatDate(effect.endDateAfter, "long"),
      before: formatDate(effect.endDateBefore, "long"),
    });
  };
}

/** The plan as it is now, so a waiting change's effect never names an end the plan doesn't show. */
type CurrentEnd = Pick<PlanView["estimate"], "endDate"> & Pick<PlanView["schedule"], "targetDate">;

function toMonth(isoDate: string): string {
  return isoDate.slice(0, "YYYY-MM".length);
}

/**
 * The end a change moves, in the plan's own terms. A plan with a date keeps it, so only a plan
 * without one says its new end, by month as its title does, and only while the change starts from
 * the end the plan shows now: an older change's dates would contradict it.
 */
function usePlanEndEffectText() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return function planEndEffect({
    current,
    effect,
  }: {
    current: CurrentEnd;
    effect: PlanChangeView["effect"];
  }): string | null {
    const before = effect?.endDateBefore;
    const after = effect?.endDateAfter;

    if (current.targetDate || !current.endDate || !before || !after) {
      return null;
    }

    if (toMonth(before) !== toMonth(current.endDate) || toMonth(after) === toMonth(before)) {
      return null;
    }

    return t("Ends around {after} instead of {before}.", {
      after: formatDate(after, "month"),
      before: formatDate(before, "month"),
    });
  };
}

/**
 * The review day ahead a focus opens with its topics: "Your review on Oct 9 starts with Osmose e
 * organelas." A class test's day before has no lessons for a focus to move, only its questions.
 */
function useReviewFirstText() {
  const t = useExtracted();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();

  return function reviewFirstText(effect: PlanChangeView["effect"]): string | null {
    const review = effect?.reviewFirst;

    return review
      ? t("Your review on {date} starts with {areas}.", {
          areas: format.list(review.areas, { type: "conjunction" }),
          date: formatDate(review.date, "long"),
        })
      : null;
  };
}

/**
 * What a proposal does, for the learner to weigh before saying yes: "Adds 6 lessons. Ends Nov 20
 * instead of Nov 12." or "Leaves out 56 lessons." With `current` (the plan on screen), its end is
 * said the plan's way, or not at all when the plan has a date. Null when it neither changes how
 * many lessons are left nor moves the end.
 */
export function useProposalEffectText() {
  const effectText = useChangeEffectText();
  const lessonsText = useLessonsEffectText();
  const topicsText = useTopicsEffectText();
  const planEndEffect = usePlanEndEffectText();
  const areaStartTexts = useAreaStartTexts();
  const reviewFirstText = useReviewFirstText();
  const weeklyEventsText = useWeeklyEventsText();

  return function proposalEffectText(
    change: Pick<PlanChangeView, "effect">,
    current?: CurrentEnd,
  ): string | null {
    // With a review ahead that the focus opens, a start that stays says nothing the review doesn't.
    const starts = (change.effect?.areaStarts ?? []).filter(
      (start) => !change.effect?.reviewFirst || start.after !== start.before,
    );

    const sentences = [
      ...areaStartTexts(starts),
      reviewFirstText(change.effect),
      weeklyEventsText(change.effect),
      lessonsText(change.effect),
      topicsText(change.effect),
      current ? planEndEffect({ current, effect: change.effect }) : effectText(change),
    ].filter(Boolean);

    return sentences.length > 0 ? sentences.join(" ") : null;
  };
}
