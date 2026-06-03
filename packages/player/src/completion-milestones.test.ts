import { describe, expect, it } from "vitest";
import { getCompletionMilestones } from "./completion-milestones";

describe(getCompletionMilestones, () => {
  it("returns a level milestone when completion reaches a new belt level", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, newTotalBp: 250 },
      previousTotalBrainPower: 240,
    });

    expect(milestones).toStrictEqual([
      {
        belt: {
          bpPerLevel: 250,
          bpToNextLevel: 250,
          color: "white",
          isMaxLevel: false,
          level: 2,
          progressInLevel: 0,
        },
        kind: "level",
        status: "achieved",
      },
    ]);
  });

  it("returns a halfway milestone when completion crosses the midpoint to the next level", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, newTotalBp: 130 },
      previousTotalBrainPower: 120,
    });

    expect(milestones).toStrictEqual([
      {
        currentBelt: {
          bpPerLevel: 250,
          bpToNextLevel: 120,
          color: "white",
          isMaxLevel: false,
          level: 1,
          progressInLevel: 130,
        },
        kind: "level",
        remainingLessons: 12,
        status: "halfway",
        targetBelt: {
          bpPerLevel: 250,
          bpToNextLevel: 250,
          color: "white",
          isMaxLevel: false,
          level: 2,
          progressInLevel: 0,
        },
      },
    ]);
  });

  it("does not repeat halfway milestones after the midpoint has already been crossed", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, newTotalBp: 140 },
      previousTotalBrainPower: 130,
    });

    expect(milestones).toStrictEqual([]);
  });

  it("prefers achieved milestones when completion also crosses a structural boundary", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, newTotalBp: 250 },
      previousTotalBrainPower: 245,
    });

    expect(milestones).toHaveLength(1);
    expect(milestones[0]?.status).toBe("achieved");
  });
});
