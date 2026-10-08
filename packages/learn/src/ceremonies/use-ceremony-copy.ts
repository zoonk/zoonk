"use client";

import { type BeltColor } from "@zoonk/utils/belt-level";
import { type BuddyGlasses, type BuddyStage } from "@zoonk/utils/buddy";
import { useExtracted } from "next-intl";
import { toBeltColor, useBeltName } from "../_utils/use-belt-name";
import { BUDDY_GLASSES } from "../buddies/buddy-labels";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";

/** A milestone as the session summary sends it; only its identity matters here. */
export type CeremonyMilestone = {
  id: string;
  /** The belt color, the buddy stage, the glasses, or `trapHunter:<boss>` for a badge. */
  key: string;
  kind: "badge" | "belt" | "glasses" | "buddyStage";
};

type CeremonyCopy = { action: string; detail: string; title: string };

const BUDDY_STAGES: BuddyStage[] = ["baby", "young", "adult", "wise"];

export function toBuddyGlasses(key: string): BuddyGlasses | null {
  return BUDDY_GLASSES.find((glasses) => glasses === key) ?? null;
}

/** Each pair's ceremony names it and the learning that earned it. */
function useGlassesCopy(glasses: BuddyGlasses | null): Omit<CeremonyCopy, "action"> {
  const t = useExtracted();

  switch (glasses) {
    case "star":
      return { detail: t("For winning your first phase challenge."), title: t("Star glasses!") };
    case "aviator":
      return {
        detail: t("For finishing your first weekly challenge."),
        title: t("Aviator glasses!"),
      };
    case "catEye":
      return { detail: t("For your seventh full meal."), title: t("Cat-eye glasses!") };
    case "retro":
      return { detail: t("For finishing 50 reviews."), title: t("Retro glasses!") };
    case "monocle":
      return { detail: t("For winning the final challenge."), title: t("A monocle!") };
    case "round":
    case null:
      return { detail: t("They come with your buddy."), title: t("New glasses!") };
    default:
      return { detail: t("They come with your buddy."), title: t("New glasses!") };
  }
}

function useStageLine({ buddyName, key }: { buddyName: string; key: string }): string {
  const t = useExtracted();
  const stage = BUDDY_STAGES.find((candidate) => candidate === key) ?? "young";

  switch (stage) {
    case "adult":
      return t("{buddy} is an Adult now, and keeps growing with your Brain Power.", {
        buddy: buddyName,
      });
    case "wise":
      return t("{buddy} is Wise now, the last stage. It grew with your Brain Power.", {
        buddy: buddyName,
      });
    case "baby":
    case "young":
      return t("{buddy} is Young now, and keeps growing with your Brain Power.", {
        buddy: buddyName,
      });
    default:
      return t("{buddy} is Young now, and keeps growing with your Brain Power.", {
        buddy: buddyName,
      });
  }
}

function useBeltTitle(color: BeltColor | null): string {
  const t = useExtracted();
  const beltName = useBeltName();

  return color ? t("{belt}!", { belt: beltName(color) }) : t("A new belt!");
}

/**
 * What a ceremony says, from fixed translated lines: a title, one line on what earned it and its
 * one button. Nothing random, and never a comparison with anyone else.
 */
export function useCeremonyCopy({
  buddy,
  canWear,
  milestone,
}: {
  buddy: LearnBuddy | null;
  /** New glasses go on with the button; without a buddy to wear them, it only continues. */
  canWear: boolean;
  milestone: CeremonyMilestone;
}): CeremonyCopy {
  const t = useExtracted();
  const buddyName = useBuddyName(buddy ?? { kind: "zu", name: null });
  const glasses = useGlassesCopy(toBuddyGlasses(milestone.key));
  const stageLine = useStageLine({ buddyName, key: milestone.key });
  const beltTitle = useBeltTitle(toBeltColor(milestone.key));
  const continueLabel = t("Continue");

  switch (milestone.kind) {
    case "belt":
      return {
        action: continueLabel,
        detail: t("Every point came from what you learned."),
        title: beltTitle,
      };
    case "buddyStage":
      return {
        action: continueLabel,
        detail: stageLine,
        title: t("{buddy} grew up!", { buddy: buddyName }),
      };
    case "glasses":
      return { ...glasses, action: canWear ? t("Wear them") : continueLabel };
    case "badge":
      return { action: continueLabel, detail: "", title: "" };
    default:
      return { action: continueLabel, detail: "", title: "" };
  }
}
