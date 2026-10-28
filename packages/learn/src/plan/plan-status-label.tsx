"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";

export type PlanStatus = NonNullable<PlanView["status"]>;

/** The learner's pace against their plan, never whether the plan reaches the goal: "On track" beside a plan covering 49% of the goal misled. */
export function usePlanStatusText() {
  const t = useExtracted();

  return (status: PlanStatus): string => {
    switch (status.kind) {
      case "ahead":
        return t("{days, plural, one {One day ahead} other {# days ahead}}", { days: status.days });
      case "behind":
        return status.lessons
          ? t("{lessons, plural, one {# lesson to catch up} other {# lessons to catch up}}", {
              lessons: status.lessons,
            })
          : t("{days, plural, one {One day behind} other {# days behind}}", { days: status.days });
      case "challengesLeft":
        return t("{count, plural, one {# challenge left} other {# challenges left}}", {
          count: status.challenges,
        });
      case "finished":
        return t("Plan finished");
      case "needsAdjusting":
        return t("Needs adjusting");
      case "onTrack":
        return t("Keeping pace");
      case "pastDate":
        return t("Past your date");
      default:
        return t("Keeping pace");
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
            "{count, plural, one {# lesson was left before your exam.} other {# lessons were left before your exam.}}",
            { count: lessons },
          ),
          title: t(
            "{count, plural, one {# lesson was left before your exam} other {# lessons were left before your exam}}",
            { count: lessons },
          ),
        }
      : {
          sentence: t(
            "{count, plural, one {Your date came with # lesson left.} other {Your date came with # lessons left.}}",
            { count: lessons },
          ),
          title: t(
            "{count, plural, one {Your date came with # lesson left} other {Your date came with # lessons left}}",
            { count: lessons },
          ),
        };
}
