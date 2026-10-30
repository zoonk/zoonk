import { planItemFixture } from "@zoonk/testing/fixtures/goals";

/** A plan keeps the phase ends it shows only once the learner has taken one of its challenges. */
export function takenChallengeFixture({ date, planId }: { date: Date; planId: string }) {
  return planItemFixture({
    completedAt: date,
    kind: "checkpoint",
    planId,
    position: -1,
    scheduledFor: date,
    status: "done",
    titleSnapshot: "Weekly challenge",
  });
}
