"use client";

import { type PlanView } from "@zoonk/core/plans/view-contract";
import { useExtracted } from "next-intl";

export type PlanStatus = NonNullable<PlanView["status"]>;

/**
 * One status in a few words: "One day ahead", "Keeping pace", "3 lessons to catch up" (lessons
 * earlier days left, until they're done), "2 days behind". Each is the learner's pace against
 * their plan, never whether the plan reaches the goal, which the plan's notice says (Marcos read
 * "On track" beside a plan covering 49% of his goal). Being behind is a count to catch up on,
 * never a judgment. A plan with every lesson and challenge done is finished, never days ahead of
 * dates it no longer needs; one with every lesson done says the challenges left; one whose date
 * came with lessons left is past its date, never "ended".
 */
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

/**
 * A plan whose date came with lessons left, as the Plan's slot titles it ("Your date came with 12
 * lessons left") and as a sentence for Today and "Your pace"; an exam's date is the exam's: "12
 * lessons were left before your exam". Never "ended": the plan keeps them until the learner
 * adjusts it.
 */
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
