"use client";

import { useExtracted } from "next-intl";

/**
 * The Trickster teases the question, never the learner: a fixed, translated line before each
 * answer and after it, picked by the question's position so a screen always says the same thing.
 */
export function useTricksterLine({
  feedback,
  position,
}: {
  feedback: { isCorrect: boolean } | null;
  position: number;
}): string {
  const t = useExtracted();

  const before = [
    t("Heh… this one trips up a lot of people."),
    t("Read it twice. It looks easy, doesn't it?"),
    t("My favorite trap is hiding in here."),
  ];

  const afterRight = [t("Hmph. You saw through that one."), t("Crack! How did you spot that?")];
  const afterWrong = [t("Ha! A classic trap."), t("That one fools almost everyone.")];

  const pick = (lines: string[]) => lines[position % lines.length] ?? lines[0] ?? "";

  if (!feedback) {
    return pick(before);
  }

  return pick(feedback.isCorrect ? afterRight : afterWrong);
}
