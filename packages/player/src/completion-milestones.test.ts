import { describe, expect, it } from "vitest";
import { getCompletionMilestoneKey } from "./completion-milestone-keys";
import { getCompletionMilestones } from "./completion-milestones";

describe(getCompletionMilestones, () => {
  it("returns a level milestone when completion reaches a new belt level", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 250 },
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
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 130 },
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
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 140 },
      previousTotalBrainPower: 130,
    });

    expect(milestones).toStrictEqual([]);
  });

  it("prefers achieved milestones when completion also crosses a structural boundary", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 250 },
      previousTotalBrainPower: 245,
    });

    expect(milestones).toHaveLength(1);
    expect(milestones[0]?.status).toBe("achieved");
  });

  it("returns an energy milestone when completion reaches the next 10% threshold", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: {
        currentEnergy: 9.9,
        fullEnergyDays: 0,
        highestPreviousDailyBrainPower: 0,
        todayBrainPower: 0,
        todayEnergyAtEnd: null,
      },
    });

    expect(milestones).toContainEqual({ energy: 10, kind: "energy", status: "threshold" });
  });

  it("does not repeat an energy threshold after it was already reached", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: {
        currentEnergy: 10,
        fullEnergyDays: 0,
        highestPreviousDailyBrainPower: 0,
        todayBrainPower: 0,
        todayEnergyAtEnd: null,
      },
    });

    expect(milestones).not.toContainEqual({ energy: 10, kind: "energy", status: "threshold" });
  });

  it("does not repeat an already shown energy threshold when the progress snapshot is stale", () => {
    const shownMilestoneKeys = [
      getCompletionMilestoneKey({
        localDate: "2026-06-05",
        milestone: { energy: 10, kind: "energy", status: "threshold" },
      }),
    ];

    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.1, newTotalBp: 20 },
      localDate: "2026-06-05",
      previousTotalBrainPower: 10,
      progressSnapshot: {
        currentEnergy: 9.9,
        fullEnergyDays: 0,
        highestPreviousDailyBrainPower: 100,
        todayBrainPower: 0,
        todayEnergyAtEnd: null,
      },
      shownMilestoneKeys,
    });

    expect(milestones).not.toContainEqual({ energy: 10, kind: "energy", status: "threshold" });
  });

  it("returns a full-energy days milestone when completion reaches a tracked day count", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 1, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: {
        currentEnergy: 99,
        fullEnergyDays: 29,
        highestPreviousDailyBrainPower: 0,
        todayBrainPower: 0,
        todayEnergyAtEnd: 99,
      },
    });

    expect(milestones).toContainEqual({ days: 30, kind: "energy", status: "fullDays" });
  });

  it("returns full-energy milestones for every thousand days after 1,000", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 1, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: {
        currentEnergy: 99,
        fullEnergyDays: 1999,
        highestPreviousDailyBrainPower: 0,
        todayBrainPower: 0,
        todayEnergyAtEnd: 99,
      },
    });

    expect(milestones).toContainEqual({ days: 2000, kind: "energy", status: "fullDays" });
  });

  it("does not repeat full-energy day milestones when today was already counted", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 1, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: {
        currentEnergy: 100,
        fullEnergyDays: 30,
        highestPreviousDailyBrainPower: 0,
        todayBrainPower: 0,
        todayEnergyAtEnd: 100,
      },
    });

    expect(milestones).not.toContainEqual({ days: 30, kind: "energy", status: "fullDays" });
  });

  it("returns a daily brain-power milestone when completion sets a new daily record", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 110 },
      previousTotalBrainPower: 100,
      progressSnapshot: {
        currentEnergy: 20,
        fullEnergyDays: 0,
        highestPreviousDailyBrainPower: 40,
        todayBrainPower: 40,
        todayEnergyAtEnd: 20,
      },
    });

    expect(milestones).toContainEqual({
      brainPower: 50,
      kind: "brainPower",
      status: "dailyRecord",
    });
  });

  it("does not treat the first positive learning day as a daily brain-power record", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: {
        currentEnergy: 0,
        fullEnergyDays: 0,
        highestPreviousDailyBrainPower: 0,
        todayBrainPower: 0,
        todayEnergyAtEnd: null,
      },
    });

    expect(milestones).not.toContainEqual({
      brainPower: 10,
      kind: "brainPower",
      status: "dailyRecord",
    });
  });

  it("does not repeat daily brain-power records once today already holds the record", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 120 },
      previousTotalBrainPower: 110,
      progressSnapshot: {
        currentEnergy: 20,
        fullEnergyDays: 0,
        highestPreviousDailyBrainPower: 40,
        todayBrainPower: 50,
        todayEnergyAtEnd: 20,
      },
    });

    expect(milestones).not.toContainEqual({
      brainPower: 60,
      kind: "brainPower",
      status: "dailyRecord",
    });
  });

  it("does not repeat a daily brain-power record from a stale same-day snapshot", () => {
    const shownMilestoneKeys = [
      getCompletionMilestoneKey({
        localDate: "2026-06-05",
        milestone: { brainPower: 50, kind: "brainPower", status: "dailyRecord" },
      }),
    ];

    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 120 },
      localDate: "2026-06-05",
      previousTotalBrainPower: 110,
      progressSnapshot: {
        currentEnergy: 20,
        fullEnergyDays: 0,
        highestPreviousDailyBrainPower: 40,
        todayBrainPower: 40,
        todayEnergyAtEnd: 20,
      },
      shownMilestoneKeys,
    });

    expect(milestones).not.toContainEqual({
      brainPower: 50,
      kind: "brainPower",
      status: "dailyRecord",
    });
  });
});
