"use client";

import { useExtracted } from "next-intl";

/**
 * What a speaking screen says when a recording had no words in it: the level test and the lesson
 * player's "say it out loud" screens say it the same way, and both let the learner try again.
 */
export function useNoSpeechMessage(): string {
  const t = useExtracted();
  return t("We couldn't hear any words. Try again.");
}
