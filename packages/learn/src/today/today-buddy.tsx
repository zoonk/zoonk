"use client";

import { Buddy, type BuddyExpression } from "@zoonk/ui/components/buddy";
import { getBuddyEnergyState } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { useTodayScreen } from "./today-context";
import { useSessionState } from "./use-today-copy";

/**
 * Learning wakes the buddy: on a day with study it never naps, even while Energy is still low. The
 * rule lives in `@zoonk/utils/buddy`; the face follows it.
 */
function useBuddyExpression(buddy: LearnBuddy): BuddyExpression | undefined {
  const { today } = useTodayScreen();
  const state = getBuddyEnergyState(buddy.energy, { studiedToday: today.studiedToday });

  if (state === "napping") {
    return "sleepy";
  }

  return today.session.fullMeal.earned ? "cheer" : undefined;
}

/** The learner's buddy on Today, with its Energy glow or nap. */
export function TodayBuddy({ className, buddy }: { className?: string; buddy: LearnBuddy }) {
  const { today } = useTodayScreen();
  const expression = useBuddyExpression(buddy);
  const name = useBuddyName(buddy);

  return (
    <Buddy
      beltColor={buddy.beltColor}
      className={className}
      energy={buddy.energy}
      expression={expression}
      glasses={buddy.glasses}
      kind={buddy.kind}
      label={name}
      studiedToday={today.studiedToday}
    />
  );
}

/**
 * The buddy's line on Today: short, fixed and translated, keyed to where the day stands. It never
 * guilts: a napping buddy is simply ready when the learner is.
 */
export function useBuddyTodayLine(buddy: LearnBuddy): string {
  const t = useExtracted();
  const { today } = useTodayScreen();
  const { done, started } = useSessionState();
  const name = useBuddyName(buddy);

  const napping =
    getBuddyEnergyState(buddy.energy, { studiedToday: today.studiedToday }) === "napping";

  if (done) {
    return today.session.fullMeal.earned
      ? t("A full meal! {name} is happy.", { name })
      : t("Nice flight. See you tomorrow!");
  }

  if (napping) {
    return t("{name} is napping. Ready when you are.", { name });
  }

  return started ? t("Next stop coming up!") : t("Ready for take off!");
}
