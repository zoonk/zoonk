"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";

export type PlanStatus = NonNullable<PlanView["status"]>;

/**
 * Where the learner stands against their plan's dates, one wording per state on every screen;
 * never whether the plan reaches the goal.
 */
export function usePlanStatusText() {
  const t = useExtracted();

  return (status: PlanStatus): string => {
    switch (status.kind) {
      case "ahead":
        return t("{days, plural, one {# day ahead} other {# days ahead}}", { days: status.days });
      case "behind":
        return status.lessons
          ? t("{lessons, plural, one {# lesson behind} other {# lessons behind}}", {
              lessons: status.lessons,
            })
          : t("{days, plural, one {# day behind} other {# days behind}}", { days: status.days });
      case "challengesLeft":
        return t("{count, plural, one {# challenge to go} other {# challenges to go}}", {
          count: status.challenges,
        });
      case "finished":
        return t("Finished");
      case "needsAdjusting":
        return t("Not enough time");
      case "onTrack":
        return t("Up to date");
      case "pastDate":
        return t("Date passed");
      default:
        return t("Up to date");
    }
  };
}

/** Never "ended": the plan keeps the lessons left until the learner adjusts it. */
export function usePastDateText() {
  const t = useExtracted();

  return ({ isExam, lessons }: { isExam: boolean; lessons: number }) =>
    isExam
      ? {
          sentence: t(
            "{count, plural, one {Your exam date has passed with # lesson left.} other {Your exam date has passed with # lessons left.}}",
            { count: lessons },
          ),
          title: t("Your exam date has passed"),
        }
      : {
          sentence: t(
            "{count, plural, one {Your end date has passed with # lesson left.} other {Your end date has passed with # lessons left.}}",
            { count: lessons },
          ),
          title: t("Your end date has passed"),
        };
}
