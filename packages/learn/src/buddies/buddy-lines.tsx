"use client";

import { useExtracted } from "next-intl";

/**
 * Moments the buddy reacts to. Its lines come from this fixed, translated set, never from a model,
 * and they only ever cheer: no guilt, no "I miss you", nothing about what the learner didn't do.
 */
export type BuddyLineEvent =
  | "bigChallenge"
  | "boss"
  | "bossLost"
  | "bossWon"
  | "challengeMoved"
  | "fedToday"
  | "guessRevealed"
  | "lessonStart"
  | "rightAnswer"
  | "rightStreak"
  | "welcomeBack"
  | "wrongAnswer";

/**
 * A short line beside the paper panel, the duel or Today. `variant` picks among a few lines for
 * the same moment (a question's position, for example), so the buddy doesn't repeat itself, and the
 * same screen always says the same thing.
 */
export function useBuddyLine(event: BuddyLineEvent, variant = 0): string {
  const t = useExtracted();

  const lines: Record<BuddyLineEvent, string[]> = {
    bigChallenge: [t("Take a deep breath. You trained for this.")],
    boss: [t("We've got this. One question at a time.")],
    bossLost: [t("Good fight! We'll practice and win the rematch.")],
    bossWon: [t("We did it! Trap hunters!")],
    challengeMoved: [t("No rush. See you Monday!")],
    fedToday: [t("That was tasty. Thank you!")],
    guessRevealed: [t("Ooh, something new!")],
    lessonStart: [t("Ready when you are."), t("Ooh, something new!")],
    rightAnswer: [t("Nice one!"), t("Exactly!"), t("You got it!")],
    rightStreak: [t("Three in a row!"), t("You're flying!")],
    welcomeBack: [t("I took a nap. Good to see you!")],
    wrongAnswer: [t("Let's go again."), t("Tricky one. It'll come back.")],
  };

  const options = lines[event];
  return options[Math.abs(variant) % options.length] ?? options[0] ?? "";
}

/**
 * A speech bubble from the buddy: short, beside the content, never inside what's being read. Where
 * its line changes on the same screen, the host keeps a polite live region around it: a region
 * that appears together with its text isn't reliably announced.
 */
export function BuddySpeech({ children, className }: { children: string; className?: string }) {
  return (
    <p
      className={
        className ??
        "fun-glass text-fun-fg max-w-56 rounded-2xl rounded-bl-md px-3 py-2 text-sm font-medium"
      }
      data-slot="buddy-speech"
    >
      {children}
    </p>
  );
}
