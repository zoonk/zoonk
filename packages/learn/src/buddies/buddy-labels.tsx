"use client";

import { type BuddyGlasses, type BuddyKind } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";
import { type LearnBuddy, useBuddyName } from "./use-buddy-name";

export const BUDDY_KINDS: BuddyKind[] = ["zu", "noodle", "beep", "otto"];

export const BUDDY_GLASSES: BuddyGlasses[] = [
  "round",
  "star",
  "aviator",
  "catEye",
  "retro",
  "monocle",
];

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

export function BuddyGlassesHowToEarn({ glasses }: { glasses: BuddyGlasses }) {
  const t = useExtracted();

  switch (glasses) {
    case "star":
      return t("Win your first challenge");
    case "aviator":
      return t("Finish your first weekly challenge");
    case "catEye":
      return t("Finish every mission on 7 different days");
    case "retro":
      return t("Finish 50 reviews");
    case "monocle":
      return t("Win your plan's last challenge");
    case "round":
      return t({
        description: "How the learner gets the round glasses: every buddy has them.",
        message: "Comes with your buddy",
      });
    default:
      return t({
        description: "How the learner gets the round glasses: every buddy has them.",
        message: "Comes with your buddy",
      });
  }
}
