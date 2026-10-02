"use client";

import { type LanguageActivityType } from "@zoonk/core/language/activities";
import { type PlanOperation } from "@zoonk/core/plans/contract";
import { OWN_LEVEL_SOURCE } from "@zoonk/core/plans/own-level-contract";
import { type PlanChangeView } from "@zoonk/core/plans/view-contract";
import { REBALANCE_SOURCE } from "@zoonk/core/preparation/rebalance";
import { useExtracted, useFormatter } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";
import { useActivityName } from "./plan-activities";
import { useSystemName } from "./use-system-name";

type ToolChoiceOperation = Extract<PlanOperation, { kind: "setTools" }>["tools"];

/** A tool answer from the "You'll use" card: "A lesson to set up Python on Windows comes first". */
function useToolSentence() {
  const t = useExtracted();
  const format = useFormatter();
  const systemName = useSystemName();

  return (tools: ToolChoiceOperation): string => {
    const names = format.list(
      tools.map((tool) => tool.name),
      { type: "conjunction" },
    );

    const [first] = tools;

    if (first?.choice === "setup" && first.system) {
      return t("A lesson to set up {tools} on {device} comes before you need it.", {
        device: systemName(first.system),
        tools: names,
      });
    }

    return first?.choice === "have"
      ? t("You have {tools}, so there's nothing to set up.", { tools: names })
      : t("No install for {tools}: you'll learn with examples.", { tools: names });
  };
}

/** Says one operation the way the learner would: "Light week from Oct 12". */
function useOperationSentence() {
  const t = useExtracted();
  const format = useFormatter();
  const formatDate = useFormatIsoDate();
  const list = (areas: string[]) => format.list(areas, { type: "conjunction" });
  const activityName = useActivityName();

  const activityList = (activities: LanguageActivityType[]) =>
    list(activities.map((activity) => activityName(activity)));

  const toolSentence = useToolSentence();

  return (operation: PlanOperation): string => {
    switch (operation.kind) {
      case "setDailyMinutes":
        return t("Daily time changed to {minutes, number} min.", { minutes: operation.minutes });
      case "setWeekdayMinutes":
        return t("Study days changed.");
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
      case "focusAreas":
        return t("More time for {areas}.", { areas: list(operation.areas) });
      case "skipAreas":
        return t("{areas} left out of the plan.", { areas: list(operation.areas) });
      case "restoreAreas":
        return t("{areas} back in the plan.", { areas: list(operation.areas) });
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
        return operation.bias === "harder"
          ? t("Harder material from now on.")
          : t("Easier material from now on.");
      case "addSkills":
        return t("Added what you need to learn first.");
      case "setTools":
        return toolSentence(operation.tools);
      default:
        return t("Your plan changed.");
    }
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

  return (change: PlanChangeView): string => {
    if (change.reason) {
      return change.reason;
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
        return t(
          "{days, plural, one {After a day away} other {After # days away}}, the plan moved forward. Nothing piles up.",
          { days: change.days ?? 1 },
        );
      case "estimateUpdated":
        return t("Your plan got more precise as you studied.");
      case "testedOut":
        return t(
          "{lessons, plural, one {You tested out of # lesson} other {You tested out of # lessons}}, so it's off your plan.",
          { lessons: change.lessonsSkipped },
        );
      default:
        return first ? operationSentence(first) : t("Your plan changed.");
    }
  };
}

/** How a change moves the end: "Ends Nov 20 instead of Nov 12". Null when the end stays. */
export function useChangeEffectText() {
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

/**
 * What a proposal does, for the learner to weigh before saying yes: "Adds 6 lessons. Ends Nov 20
 * instead of Nov 12." Null when it neither adds lessons nor moves the end.
 */
export function useProposalEffectText() {
  const t = useExtracted();
  const effectText = useChangeEffectText();

  return function proposalEffectText(change: Pick<PlanChangeView, "effect">): string | null {
    const lessonsAdded = change.effect?.lessonsAdded ?? 0;

    const sentences = [
      lessonsAdded > 0 &&
        t("Adds {lessons, plural, one {# lesson} other {# lessons}}.", { lessons: lessonsAdded }),
      effectText(change),
    ].filter(Boolean);

    return sentences.length > 0 ? sentences.join(" ") : null;
  };
}
