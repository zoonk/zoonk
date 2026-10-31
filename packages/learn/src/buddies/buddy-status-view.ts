import { type BuddyStatusResult } from "@zoonk/core/milestones/buddy";
import { type LearnBuddy } from "./use-buddy-name";

export type BuddyStatusView = Extract<BuddyStatusResult, { status: "ready" }>["buddy"];

export type BuddyGlassesProgress = BuddyStatusView["glasses"][number];

export type BuddyToday = Pick<NonNullable<BuddyStatusView["today"]>, "fullMeal" | "missions">;

export type BuddyMission = BuddyToday["missions"][number];

export type FirstSteps = NonNullable<BuddyStatusView["firstSteps"]>;

export type FirstStep = FirstSteps["steps"][number];

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
