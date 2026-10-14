"use client";

import { type BuddyGlasses, type BuddyKind, type BuddyStage } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";
import { type LearnBuddy, useBuddyName } from "./use-buddy-name";

/** Every buddy in the order learners meet them. */
export const BUDDY_KINDS: BuddyKind[] = ["zu", "noodle", "beep", "otto"];

/** Round comes with the buddy; the rest follow the order they're usually earned. */
export const BUDDY_GLASSES: BuddyGlasses[] = [
  "round",
  "star",
  "aviator",
  "catEye",
  "retro",
  "monocle",
];

/**
 * What the buddy's tab is called: the buddy's own name or its custom name. Links back to
 * that tab say it the same way.
 */
export function BuddyTabName({ buddy }: { buddy: Pick<LearnBuddy, "kind" | "name"> | null }) {
  return useBuddyName(buddy);
}

export function BuddyTagline({ kind }: { kind: BuddyKind }) {
  const t = useExtracted();

  switch (kind) {
    case "noodle":
      return t("Brain with legs");
    case "beep":
      return t("Tidy robot");
    case "otto":
      return t("Know-it-all octopus");
    case "zu":
      return t("Curious alien");
    default:
      return t("Curious alien");
  }
}

export function BuddyStageName({ stage }: { stage: BuddyStage }) {
  const t = useExtracted();

  switch (stage) {
    case "young":
      return t("Young");
    case "adult":
      return t("Adult");
    case "wise":
      return t("Wise");
    case "baby":
      return t("Baby");
    default:
      return t("Baby");
  }
}

export function BuddyGlassesName({ glasses }: { glasses: BuddyGlasses }) {
  const t = useExtracted();

  switch (glasses) {
    case "star":
      return t("Star");
    case "aviator":
      return t("Aviator");
    case "catEye":
      return t("Cat-eye");
    case "retro":
      return t("Retro");
    case "monocle":
      return t("Monocle");
    case "round":
      return t("Round");
    default:
      return t("Round");
  }
}

/**
 * What the buddy wears, as a phrase that stands on its own after its stage ("Baby · Round
 * glasses"), where the pair's bare name (`BuddyGlassesName`, the picker's) would say nothing.
 */
export function BuddyGlassesWorn({ glasses }: { glasses: BuddyGlasses }) {
  const t = useExtracted();

  switch (glasses) {
    case "star":
      return t("Star glasses");
    case "aviator":
      return t("Aviator glasses");
    case "catEye":
      return t("Cat-eye glasses");
    case "retro":
      return t("Retro glasses");
    case "monocle":
      return t("A monocle");
    case "round":
      return t("Round glasses");
    default:
      return t("Round glasses");
  }
}

/** Every pair says upfront how it's earned: nothing is random and nothing is sold. */
export function BuddyGlassesHowToEarn({ glasses }: { glasses: BuddyGlasses }) {
  const t = useExtracted();

  switch (glasses) {
    case "star":
      return t("Win your first phase challenge");
    case "aviator":
      return t("Finish your first weekly challenge");
    case "catEye":
      return t("Finish every mission on 7 different days");
    case "retro":
      return t("Finish 50 reviews");
    case "monocle":
      return t("Win the final challenge");
    case "round":
      return t("Comes with your buddy");
    default:
      return t("Comes with your buddy");
  }
}
