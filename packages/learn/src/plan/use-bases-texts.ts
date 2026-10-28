"use client";

import { type PlanBasesAdvice } from "@zoonk/core/plans/bases-advice-contract";
import { type PlanBasesView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";
import { usePlanScreen } from "./plan-context";

export type RecommendedBases = Pick<PlanBasesAdvice, "daysLeft"> & {
  recommended: NonNullable<PlanBasesAdvice["recommended"]>;
};

export function usePlanBases(): PlanBasesView | null {
  const { plan } = usePlanScreen();
  return plan.bases && plan.bases.items.length > 0 ? plan.bases : null;
}

export function useAdviceText() {
  const t = useExtracted();
  const { goal } = usePlanScreen();
  const isExam = goal.kind === "exam";

  return ({ daysLeft, recommended }: RecommendedBases): string => {
    if (recommended === "deep") {
      return t("Your time covers everything, so we recommend each prerequisite in depth.");
    }

    if (recommended === "quick" && daysLeft !== null) {
      return isExam
        ? t(
            "{days, plural, one {# day left} other {# days left}}: we recommend a quick lesson for each prerequisite, so there's time for what comes up most.",
            { days: daysLeft },
          )
        : t(
            "{days, plural, one {# day left} other {# days left}}: we recommend a quick lesson for each prerequisite, so there's time for what matters most to your goal.",
            { days: daysLeft },
          );
    }

    return isExam
      ? t("We recommend the essentials, so the topics that build on them make sense.")
      : t("We recommend the essentials, so what builds on them makes sense.");
  };
}

export function usePrerequisitesDescription() {
  const t = useExtracted();
  const { goal } = usePlanScreen();

  return goal.kind === "exam"
    ? t("Topics that come up a lot build on these.")
    : t("Your goal's final work builds on these.");
}

export function useKnownText() {
  const t = useExtracted();

  return (bases: PlanBasesView): string =>
    bases.knownCount > 0
      ? t(
          "{count, plural, one {# prerequisite you showed you know is already out of your plan.} other {# prerequisites you showed you know are already out of your plan.}}",
          { count: bases.knownCount },
        )
      : t("Already know some? Show it in a test and they leave your plan on their own.");
}

function minutesOf(item: PlanBasesView["items"][number]): number {
  return item.choice === "skip" ? 0 : item.minutes[item.choice];
}

export function useSummaryText() {
  const t = useExtracted();
  const formatDuration = useFormatDuration();

  return (bases: PlanBasesView): string => {
    const values = {
      count: bases.items.length,
      time: formatDuration(bases.items.reduce((sum, item) => sum + minutesOf(item), 0)),
    };

    const choices = new Set(bases.items.map((item) => item.choice));
    const [shared] = choices;

    if (choices.size > 1) {
      return t(
        "{count, plural, one {# prerequisite, {time} with your choice.} other {# prerequisites, {time} with your choices.}}",
        values,
      );
    }

    if (shared === "deep") {
      return t(
        "{count, plural, one {# prerequisite, {time} in depth.} other {# prerequisites, {time} in depth.}}",
        values,
      );
    }

    if (shared === "quick") {
      return t(
        "{count, plural, one {# prerequisite, {time} for its quick lesson.} other {# prerequisites, {time} for a quick lesson each.}}",
        values,
      );
    }

    if (shared === "skip") {
      return t(
        "{count, plural, one {# prerequisite, skipped.} other {# prerequisites, all skipped.}}",
        values,
      );
    }

    return t(
      "{count, plural, one {# prerequisite, {time} for its essentials.} other {# prerequisites, {time} for their essentials.}}",
      values,
    );
  };
}
