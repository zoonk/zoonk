"use client";

import { saveBuddyAction } from "@/app/[lang]/(settings)/settings/appearance/actions";
import { type CeremonyMilestone, MilestoneCeremony } from "@zoonk/learn/ceremony";
import { type LearnBuddy } from "@zoonk/learn/navigation";
import { markMilestoneShownAction } from "./milestone-actions";

/**
 * The session's one milestone for the end-of-session summary: Fun's ceremony or Focus's quiet
 * badge. It marks itself as shown, and new glasses can go on the buddy right away.
 */
export function SessionCeremony({
  brainPower,
  milestone,
  buddy,
}: {
  brainPower: number | null;
  milestone: CeremonyMilestone;
  buddy: LearnBuddy | null;
}) {
  return (
    <MilestoneCeremony
      brainPower={brainPower}
      milestone={milestone}
      onShown={markMilestoneShownAction}
      onWearGlasses={
        buddy
          ? (glasses) => saveBuddyAction({ glasses, kind: buddy.kind, name: buddy.name })
          : undefined
      }
      buddy={buddy}
    />
  );
}
