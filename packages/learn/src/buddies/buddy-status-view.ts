import { type BuddyStatusResult } from "@zoonk/core/milestones/buddy";
import { type LearnBuddy } from "./use-buddy-name";

/** The buddy's page as core sends it: Energy, stage, today's missions and the glasses. */
export type BuddyStatusView = Extract<BuddyStatusResult, { status: "ready" }>["buddy"];

export type BuddyGlassesProgress = BuddyStatusView["glasses"][number];

/** Today's missions and the full meal they add up to, as the buddy and Today draw them. */
export type BuddyToday = Pick<NonNullable<BuddyStatusView["today"]>, "fullMeal" | "missions">;

export type BuddyMission = BuddyToday["missions"][number];

/** A new learner's first steps (one first use of each feature their plan has); null once retired. */
export type FirstSteps = NonNullable<BuddyStatusView["firstSteps"]>;

export type FirstStep = FirstSteps["steps"][number];

/**
 * The learner's buddy as the screens draw it: its kind, name and glasses (`buddy`, which may be a
 * change not saved yet), grown by the belt and lit by Energy.
 */
export function toLearnBuddy({
  buddy,
  status,
}: {
  buddy: BuddyStatusView["buddy"];
  status: BuddyStatusView;
}): LearnBuddy {
  return {
    ...buddy,
    beltColor: status.belt.color,
    energy: status.energy.current,
    studiedToday: status.energy.studiedToday,
  };
}
