"use client";

import { useExtracted } from "next-intl";
import { usePlanScreen } from "./plan-context";
import { usePastDateText } from "./plan-status-label";

/**
 * The plan's status in one sentence: no longer fitting (`adjust`: the way out is adjusting the
 * plan), the small fix for a delay, its date that came with lessons left, or every lesson done with
 * challenges left (what finishing it takes). The plan's notice and the Plan's "Your pace" say it
 * alike.
 */
export function usePaceFixText(): { adjust: boolean; text: string } | null {
  const t = useExtracted();
  const pastDateText = usePastDateText();
  const { goal, plan } = usePlanScreen();
  const { status } = plan;

  // The Plan's slot holds the change that keeps the plan going, right under the pace.
  if (status?.kind === "pastDate") {
    return {
      adjust: false,
      text: pastDateText({ isExam: goal.kind === "exam", lessons: status.lessons }).sentence,
    };
  }

  if (status?.kind === "challengesLeft") {
    return {
      adjust: false,
      text: t(
        "{count, plural, one {Every lesson is done: win the challenge to finish your plan.} other {Every lesson is done: win the challenges to finish your plan.}}",
        { count: status.challenges },
      ),
    };
  }

  if (status?.kind === "needsAdjusting") {
    return { adjust: true, text: t("Your plan no longer fits in the time left.") };
  }

  if (status?.kind === "behind" && status.lessons) {
    return {
      adjust: false,
      text: t(
        "{lessons, plural, one {# lesson from earlier days comes first} other {# lessons from earlier days come first}}: once you've done them, you're keeping pace again.",
        { lessons: status.lessons },
      ),
    };
  }

  if (status?.kind === "behind") {
    return {
      adjust: false,
      text: t(
        "{minutes, number} more minutes a day for {days, plural, one {# day} other {# days}} and you're keeping pace again.",
        { days: status.days, minutes: status.extraMinutesPerDay },
      ),
    };
  }

  return null;
}
