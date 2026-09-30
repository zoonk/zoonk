"use client";

import { type BuddyGlasses, type BuddyKind, type BuddyStage } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";

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

/** The stages a buddy grows through, youngest first. */
export const BUDDY_STAGES: BuddyStage[] = ["baby", "young", "adult", "wise"];

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

/** Every pair says upfront how it's earned: nothing is random and nothing is sold. */
export function BuddyGlassesHowToEarn({ glasses }: { glasses: BuddyGlasses }) {
  const t = useExtracted();

  switch (glasses) {
    case "star":
      return t("Beat your first boss");
    case "aviator":
      return t("Finish your first Big Challenge");
    case "catEye":
      return t("Have 7 full meals");
    case "retro":
      return t("Open 50 capsules");
    case "monocle":
      return t("Beat the final boss");
    case "round":
      return t("Comes with your buddy");
    default:
      return t("Comes with your buddy");
  }
}
