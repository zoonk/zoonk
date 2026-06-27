import { describe, expect, it } from "vitest";
import { getCompletionMilestoneKey } from "./completion-milestone-keys";
import { type PlayerProgressSnapshot, getCompletionMilestones } from "./completion-milestones";

function buildProgressSnapshot(
  overrides: Partial<PlayerProgressSnapshot> = {},
): PlayerProgressSnapshot {
  return {
    bestDayScores: [],
    currentEnergy: 0,
    fullEnergyDays: 0,
    highestPreviousDailyBrainPower: 0,
    learningDays: 0,
    todayBrainPower: 0,
    todayCompletedLessons: 0,
    todayEnergyAtEnd: null,
    todayInteractiveLessons: 0,
    totalLearningSeconds: 0,
    ...overrides,
  };
}

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
    expect(milestones[0]).toMatchObject({ kind: "level", status: "achieved" });
  });

  it("returns an energy milestone when completion reaches the next 10% threshold", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({ currentEnergy: 9.9 }),
    });

    expect(milestones).toContainEqual({ energy: 10, kind: "energy", status: "threshold" });
  });

  it("does not repeat an energy threshold after it was already reached", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({ currentEnergy: 10 }),
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
      progressSnapshot: buildProgressSnapshot({
        currentEnergy: 9.9,
        highestPreviousDailyBrainPower: 100,
      }),
      shownMilestoneKeys,
    });

    expect(milestones).not.toContainEqual({ energy: 10, kind: "energy", status: "threshold" });
  });

  it("returns a full-energy days milestone when completion reaches a tracked day count", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 1, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({
        currentEnergy: 99,
        fullEnergyDays: 29,
        todayEnergyAtEnd: 99,
      }),
    });

    expect(milestones).toContainEqual({ days: 30, kind: "energy", status: "fullDays" });
  });

  it("returns full-energy milestones for every thousand days after 1,000", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 1, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({
        currentEnergy: 99,
        fullEnergyDays: 1999,
        todayEnergyAtEnd: 99,
      }),
    });

    expect(milestones).toContainEqual({ days: 2000, kind: "energy", status: "fullDays" });
  });

  it("does not repeat full-energy day milestones when today was already counted", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 1, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({
        currentEnergy: 100,
        fullEnergyDays: 30,
        todayEnergyAtEnd: 100,
      }),
    });

    expect(milestones).not.toContainEqual({ days: 30, kind: "energy", status: "fullDays" });
  });

  it("returns a daily brain-power milestone when completion sets a new daily record", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 110 },
      previousTotalBrainPower: 100,
      progressSnapshot: buildProgressSnapshot({
        currentEnergy: 20,
        highestPreviousDailyBrainPower: 40,
        todayBrainPower: 40,
        todayEnergyAtEnd: 20,
      }),
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
      progressSnapshot: buildProgressSnapshot(),
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
      progressSnapshot: buildProgressSnapshot({
        currentEnergy: 20,
        highestPreviousDailyBrainPower: 40,
        todayBrainPower: 50,
        todayEnergyAtEnd: 20,
      }),
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
      progressSnapshot: buildProgressSnapshot({
        currentEnergy: 20,
        highestPreviousDailyBrainPower: 40,
        todayBrainPower: 40,
        todayEnergyAtEnd: 20,
      }),
      shownMilestoneKeys,
    });

    expect(milestones).not.toContainEqual({
      brainPower: 50,
      kind: "brainPower",
      status: "dailyRecord",
    });
  });

  it("returns a learning-days milestone when completion starts a tracked new day", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({ learningDays: 4 }),
    });

    expect(milestones).toContainEqual({ days: 5, kind: "learningDays" });
  });

  it("does not repeat a learning-days milestone when today already counted", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 10 },
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({ learningDays: 4, todayCompletedLessons: 1 }),
    });

    expect(milestones).not.toContainEqual({ days: 5, kind: "learningDays" });
  });

  it("returns learning-days milestones for hundreds through 1,000 and thousands after that", () => {
    const cases = [
      { expectedDays: 100 },
      { expectedDays: 400 },
      { expectedDays: 700 },
      { expectedDays: 900 },
      { expectedDays: 1000 },
      { expectedDays: 3000 },
      { expectedDays: 9000 },
      { expectedDays: 10_000 },
    ];

    for (const { expectedDays } of cases) {
      const milestones = getCompletionMilestones({
        completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 10 },
        previousTotalBrainPower: 0,
        progressSnapshot: buildProgressSnapshot({ learningDays: expectedDays - 1 }),
      });

      expect(milestones).toContainEqual({ days: expectedDays, kind: "learningDays" });
    }
  });

  it("returns a learning-time milestone when completion reaches ten minutes", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 10 },
      lessonDurationSeconds: 20,
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({ totalLearningSeconds: 580 }),
    });

    expect(milestones).toContainEqual({ kind: "learningTime", seconds: 600 });
  });

  it("returns the special full-day learning-time milestone at 24 hours", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 10 },
      lessonDurationSeconds: 120,
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({ totalLearningSeconds: 86_280 }),
    });

    expect(milestones).toContainEqual({ kind: "learningTime", seconds: 86_400 });
  });

  it("returns large learning-time milestones on the expected hour steps", () => {
    const milestones = getCompletionMilestones({
      completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 10 },
      lessonDurationSeconds: 120,
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({ totalLearningSeconds: 3_599_980 }),
    });

    expect(milestones).toContainEqual({ kind: "learningTime", seconds: 3_600_000 });
  });

  it("returns learning-time milestones throughout each stepped hour interval", () => {
    const cases = [
      { expectedHours: 100 },
      { expectedHours: 300 },
      { expectedHours: 700 },
      { expectedHours: 900 },
      { expectedHours: 4000 },
      { expectedHours: 90_000 },
      { expectedHours: 900_000 },
      { expectedHours: 9_000_000 },
    ];

    for (const { expectedHours } of cases) {
      const expectedSeconds = expectedHours * 60 * 60;

      const milestones = getCompletionMilestones({
        completion: { brainPower: 10, energyDelta: 0.2, newTotalBp: 10 },
        lessonDurationSeconds: 1,
        previousTotalBrainPower: 0,
        progressSnapshot: buildProgressSnapshot({ totalLearningSeconds: expectedSeconds - 1 }),
      });

      expect(milestones).toContainEqual({ kind: "learningTime", seconds: expectedSeconds });
    }
  });

  it("returns a best-day milestone on the first interactive completion of the best weekday", () => {
    const milestones = getCompletionMilestones({
      completion: {
        brainPower: 10,
        completedInteractiveLesson: true,
        correctCount: 1,
        energyDelta: 0.2,
        incorrectCount: 0,
        newTotalBp: 10,
      },
      localDate: "2026-06-08",
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({
        bestDayScores: [
          { correctAnswers: 17, dayOfWeek: 1, incorrectAnswers: 2 },
          { correctAnswers: 14, dayOfWeek: 2, incorrectAnswers: 6 },
        ],
      }),
    });

    expect(milestones).toContainEqual({
      dayOfWeek: 1,
      kind: "score",
      score: 90,
      status: "bestDay",
    });
  });

  it("returns a best-day milestone when the current lesson makes today the best weekday", () => {
    const milestones = getCompletionMilestones({
      completion: {
        brainPower: 10,
        completedInteractiveLesson: true,
        correctCount: 10,
        energyDelta: 0.2,
        incorrectCount: 0,
        newTotalBp: 10,
      },
      localDate: "2026-06-08",
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({
        bestDayScores: [{ correctAnswers: 8, dayOfWeek: 2, incorrectAnswers: 2 }],
      }),
    });

    expect(milestones).toContainEqual({
      dayOfWeek: 1,
      kind: "score",
      score: 100,
      status: "bestDay",
    });
  });

  it("does not show best-day milestones when the current lesson makes another weekday best", () => {
    const milestones = getCompletionMilestones({
      completion: {
        brainPower: 10,
        completedInteractiveLesson: true,
        correctCount: 0,
        energyDelta: 0.2,
        incorrectCount: 10,
        newTotalBp: 10,
      },
      localDate: "2026-06-08",
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({
        bestDayScores: [
          { correctAnswers: 1, dayOfWeek: 1, incorrectAnswers: 0 },
          { correctAnswers: 8, dayOfWeek: 2, incorrectAnswers: 2 },
        ],
      }),
    });

    expect(milestones).not.toContainEqual({
      dayOfWeek: 1,
      kind: "score",
      score: 100,
      status: "bestDay",
    });
  });

  it("does not repeat the best-day milestone after an interactive lesson today", () => {
    const milestones = getCompletionMilestones({
      completion: {
        brainPower: 10,
        completedInteractiveLesson: true,
        correctCount: 1,
        energyDelta: 0.2,
        incorrectCount: 0,
        newTotalBp: 10,
      },
      localDate: "2026-06-08",
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({
        bestDayScores: [{ correctAnswers: 18, dayOfWeek: 1, incorrectAnswers: 2 }],
        todayInteractiveLessons: 1,
      }),
    });

    expect(milestones).not.toContainEqual({
      dayOfWeek: 1,
      kind: "score",
      score: 90,
      status: "bestDay",
    });
  });

  it("does not show the best-day milestone for static lesson completions", () => {
    const milestones = getCompletionMilestones({
      completion: {
        brainPower: 10,
        completedInteractiveLesson: false,
        correctCount: 0,
        energyDelta: 0.1,
        incorrectCount: 0,
        newTotalBp: 10,
      },
      localDate: "2026-06-08",
      previousTotalBrainPower: 0,
      progressSnapshot: buildProgressSnapshot({
        bestDayScores: [{ correctAnswers: 18, dayOfWeek: 1, incorrectAnswers: 2 }],
      }),
    });

    expect(milestones).not.toContainEqual({
      dayOfWeek: 1,
      kind: "score",
      score: 90,
      status: "bestDay",
    });
  });
});
