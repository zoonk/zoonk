"use client";

import { saveBuddyAction } from "@/app/[lang]/(settings)/settings/appearance/actions";
import { type LearnerBuddy } from "@/lib/learn/learner-buddy";
import { type CeremonyMilestone, MilestoneCeremony } from "@zoonk/learn/ceremony";
import { markMilestoneShownAction } from "./milestone-actions";

/**
 * The session's one milestone as a full-screen moment between the summary's steps, marked as shown
 * once it appears. New glasses can go on the buddy right away.
 */
export function SessionCeremony({
  milestone,
  buddy,
  onClose,
}: {
  milestone: CeremonyMilestone;
  buddy: LearnerBuddy;
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
