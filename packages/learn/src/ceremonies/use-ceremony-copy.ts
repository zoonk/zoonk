"use client";

import { type BeltColor } from "@zoonk/utils/belt-level";
import { type BuddyGlasses, type BuddyStage } from "@zoonk/utils/buddy";
import { useExtracted, useFormatter } from "next-intl";
import { toBeltColor, useBeltName } from "../_utils/use-belt-name";
import { BUDDY_GLASSES, BUDDY_STAGES } from "../buddies/buddy-labels";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";

/** A milestone as the session summary sends it; only its identity matters here. */
export type CeremonyMilestone = {
  id: string;
  /** The belt color, the buddy stage, the glasses, or `trapHunter:<boss>` for a badge. */
  key: string;
  kind: "badge" | "belt" | "glasses" | "buddyStage";
};

type CeremonyCopy = {
  action: string;
  detail: string;
  eyebrow: string;
  glasses: BuddyGlasses | null;
  subtitle: string | null;
  title: string;
};

export function toBuddyGlasses(key: string): BuddyGlasses | null {
  return BUDDY_GLASSES.find((glasses) => glasses === key) ?? null;
}

export function toBuddyStage(key: string): BuddyStage | null {
  return BUDDY_STAGES.find((stage) => stage === key) ?? null;
}

function useGlassesCopy(glasses: BuddyGlasses | null) {
  const t = useExtracted();

  switch (glasses) {
    case "star":
      return { detail: t("For beating your first boss."), title: t("Star glasses!") };
    case "aviator":
      return { detail: t("For your first Big Challenge."), title: t("Aviator glasses!") };
    case "catEye":
      return { detail: t("For seven full meals."), title: t("Cat-eye glasses!") };
    case "retro":
      return { detail: t("For opening fifty capsules."), title: t("Retro glasses!") };
    case "monocle":
      return { detail: t("For beating the final boss."), title: t("A monocle!") };
    case "round":
    case null:
      return { detail: t("They come with your buddy."), title: t("New glasses!") };
    default:
      return { detail: t("They come with your buddy."), title: t("New glasses!") };
  }
}

function useStageLine({ buddyName, stage }: { buddyName: string; stage: BuddyStage | null }) {
  const t = useExtracted();

  switch (stage) {
    case "adult":
      return t("{buddy} is now an Adult", { buddy: buddyName });
    case "wise":
      return t("{buddy} is now Wise", { buddy: buddyName });
    case "baby":
    case "young":
    case null:
      return t("{buddy} is now Young", { buddy: buddyName });
    default:
      return t("{buddy} is now Young", { buddy: buddyName });
  }
}

function useBeltTitle(color: BeltColor | null) {
  const t = useExtracted();
  const beltName = useBeltName();

  return color ? t("{belt}!", { belt: beltName(color) }) : t("A new belt!");
}

/** What a ceremony says, from fixed translated lines: nothing random, and never a comparison. */
export function useCeremonyCopy({
  brainPower = null,
  milestone,
  buddy,
}: {
  brainPower?: number | null;
  milestone: CeremonyMilestone;
  buddy: LearnBuddy | null;
}): CeremonyCopy {
  const t = useExtracted();
  const format = useFormatter();
  const buddyName = useBuddyName(buddy ?? { kind: "zu", name: null });
  const glasses = toBuddyGlasses(milestone.key);
  const glassesCopy = useGlassesCopy(glasses);
  const stageLine = useStageLine({ buddyName, stage: toBuddyStage(milestone.key) });
  const beltTitle = useBeltTitle(toBeltColor(milestone.key));

  const badge: CeremonyCopy = {
    action: t("Continue"),
    detail: t("For beating a boss. It's in your logbook."),
    eyebrow: t("New badge"),
    glasses: null,
    subtitle: null,
    title: t("Trap hunter"),
  };

  switch (milestone.kind) {
    case "belt":
      return {
        action: t("Put on the belt"),
        detail:
          brainPower === null
            ? t("Every point came from what you learned.")
            : t("You reached {points} Brain Power. Every point came from what you learned.", {
                points: format.number(brainPower),
              }),
        eyebrow: t("Belt ceremony"),
        glasses: null,
        subtitle: null,
        title: beltTitle,
      };
    case "buddyStage":
      return {
        action: t("Continue"),
        detail: t("{buddy} grows with your Brain Power, which never goes down.", {
          buddy: buddyName,
        }),
        eyebrow: t("Growing up"),
        glasses: null,
        subtitle: stageLine,
        title: t("{buddy} grew up!", { buddy: buddyName }),
      };
    case "glasses":
      return {
        action: t("Wear them"),
        detail: glassesCopy.detail,
        eyebrow: t("New glasses"),
        glasses,
        subtitle: null,
        title: glassesCopy.title,
      };
    case "badge":
      return badge;
    default:
      return badge;
  }
}

function useAchievementTitle(glasses: BuddyGlasses | null) {
  const t = useExtracted();

  switch (glasses) {
    case "star":
      return t("First phase checkpoint passed");
    case "aviator":
      return t("First weekly challenge done");
    case "catEye":
      return t("Seven complete sessions");
    case "retro":
      return t("Fifty reviews done");
    case "monocle":
      return t("Final checkpoint passed");
    case "round":
    case null:
      return t("A new milestone");
    default:
      return t("A new milestone");
  }
}

/**
 * Focus has no buddy and no Trickster, so the same milestone lands as what the learner did: a
 * checkpoint passed, a week's challenge done. Belts read the same in both modes.
 */
export function useFocusMilestoneCopy(
  milestone: CeremonyMilestone,
): { detail: string; title: string } | null {
  const t = useExtracted();
  const achievement = useAchievementTitle(toBuddyGlasses(milestone.key));
  const detail = t("Earned by your own learning.");

  if (milestone.kind === "glasses") {
    return { detail, title: achievement };
  }

  if (milestone.kind === "badge") {
    return { detail, title: t("Phase checkpoint passed") };
  }

  return null;
}
