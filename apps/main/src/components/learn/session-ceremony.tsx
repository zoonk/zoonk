"use client";

import { saveBuddyAction } from "@/app/[lang]/(app)/(settings)/settings/appearance/actions";
import { type LearnBuddy } from "@zoonk/learn/buddy-name";
import { type CeremonyMilestone, MilestoneCeremony } from "@zoonk/learn/ceremony";
import { markMilestoneShownAction } from "./milestone-actions";

export function SessionCeremony({
  milestone,
  buddy,
  onClose,
}: {
  milestone: CeremonyMilestone;
  buddy: LearnBuddy | null;
  onClose: () => void;
}) {
  return (
    <MilestoneCeremony
      buddy={buddy}
      milestone={milestone}
      onClose={onClose}
      onShown={markMilestoneShownAction}
      onWearGlasses={
        buddy
          ? (glasses) => saveBuddyAction({ glasses, kind: buddy.kind, name: buddy.name })
          : undefined
      }
    />
  );
}
