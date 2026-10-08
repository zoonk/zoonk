import { type BuddyStatusResult } from "@zoonk/core/milestones/buddy";

/** The buddy's page as core sends it: Energy, stage, today's missions and the glasses. */
export type BuddyStatusView = Extract<BuddyStatusResult, { status: "ready" }>["buddy"];

export type BuddyGlassesProgress = BuddyStatusView["glasses"][number];

export type BuddyToday = NonNullable<BuddyStatusView["today"]>;

export type BuddyMission = BuddyToday["missions"][number];
