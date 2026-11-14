"use client";

import { useExtracted } from "next-intl";
import { usePlanScreen } from "./plan-context";
import { usePastDateText } from "./plan-status-label";

/** The one sentence under a state that isn't "Up to date": what it means, or the way out. */
export function usePlanStateLine(): { adjust: boolean; text: string; today: boolean } | null {
  const t = useExtracted();
  const pastDateText = usePastDateText();
  const { goal, plan } = usePlanScreen();
  const { status } = plan;

  if (status?.kind === "pastDate") {
    return {
      adjust: false,
      text: pastDateText({ isExam: goal.kind === "exam", lessons: status.lessons }).sentence,
      today: false,
    };
  }

  if (status?.kind === "challengesLeft") {
    return {
      adjust: false,
      text: t(
        "{count, plural, one {Every lesson is done. Win the challenge to finish your plan.} other {Every lesson is done. Win the challenges to finish your plan.}}",
        { count: status.challenges },
      ),
      today: false,
    };
  }

  if (status?.kind === "needsAdjusting") {
    return {
      adjust: true,
      text: t("You have more lessons than days left. Add time a day or pick a later date."),
      today: false,
    };
  }

  if (status?.kind === "behind" && status.lessons) {
    return { adjust: false, text: t("They come first on Today."), today: true };
  }

  if (status?.kind === "behind") {
    return {
      adjust: false,
      text: t(
        "{days, plural, one {Study {minutes, number} more min a day for # day to be up to date.} other {Study {minutes, number} more min a day for # days to be up to date.}}",
        { days: status.days, minutes: status.extraMinutesPerDay },
      ),
      today: false,
    };
  }

  return null;
}
