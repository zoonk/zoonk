import { type Milestone } from "@zoonk/db";
import { getBeltStartBrainPower } from "@zoonk/utils/belt-level";
import { describe, expect, it } from "vitest";
import { serializeMilestone } from "./completion-contract";

function milestone(overrides: Pick<Milestone, "key" | "kind">): Milestone {
  return {
    earnedAt: new Date("2026-10-29T12:00:00.000Z"),
    id: "01a12345-0000-7000-8000-000000000001",
    shownAt: null,
    userId: "01a12345-0000-7000-8000-000000000002",
    ...overrides,
  };
}

describe(serializeMilestone, () => {
  it("gives a belt the Brain Power it starts at, which the ceremony says the learner reached", () => {
    expect(serializeMilestone(milestone({ key: "yellow", kind: "belt" })).beltStartBrainPower).toBe(
      getBeltStartBrainPower("yellow"),
    );
  });

  it("gives other milestones no belt start", () => {
    expect(
      serializeMilestone(milestone({ key: "star", kind: "glasses" })).beltStartBrainPower,
    ).toBeNull();
  });

  it("leaves out the learner's id", () => {
    expect(serializeMilestone(milestone({ key: "yellow", kind: "belt" }))).not.toHaveProperty(
      "userId",
    );
  });
});
