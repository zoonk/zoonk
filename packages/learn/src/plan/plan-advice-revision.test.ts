import { describe, expect, it } from "vitest";
import { getPlanAdviceRevision } from "./plan-advice-revision";

function searchedPlan(planId: string) {
  return {
    areas: [],
    bases: null,
    examChoices: [],
    feasibility: {
      coreFits: true,
      coveredShare: 0,
      deadline: "2026-11-30",
      deepensMostAsked: false,
      fits: false,
      measure: "goal" as const,
      timeCovers: false,
    },
    planId,
    schedule: {
      dailyMinutes: 30,
      dailyTimes: [15, 30, 45],
      fullCourse: false,
      lightWeeks: [],
      mocks: null,
      nextSitting: null,
      noSitting: null,
      noticeDay: null,
      shape: {
        canDiffer: false,
        weekdayDays: [1, 2, 3, 4, 5],
        weekdays: 30,
        weekend: null,
        weekendDays: [],
      },
      studyDays: 5,
      targetDate: "2026-11-30",
      targetDateEstimated: false,
      targetDateNamedMonth: false,
      weekdayMinutes: [0, 30, 30, 30, 30, 30, 0],
    },
    steering: {
      difficultyBias: "standard" as const,
      lessonsStudied: 0,
      practiceBias: "balanced" as const,
      skippedActivities: [],
    },
  };
}

describe(getPlanAdviceRevision, () => {
  it("keys an answer to the plan it was found for, never to another goal's plan that looks the same", () => {
    expect(getPlanAdviceRevision({ plan: searchedPlan("plan-a"), today: "2026-11-14" })).not.toBe(
      getPlanAdviceRevision({ plan: searchedPlan("plan-b"), today: "2026-11-14" }),
    );
  });

  it("keeps the answer when the same plan comes back unchanged", () => {
    expect(getPlanAdviceRevision({ plan: searchedPlan("plan-a"), today: "2026-11-14" })).toBe(
      getPlanAdviceRevision({ plan: searchedPlan("plan-a"), today: "2026-11-14" }),
    );
  });

  it("asks again on a new day, since the days left change the answer", () => {
    expect(getPlanAdviceRevision({ plan: searchedPlan("plan-a"), today: "2026-11-14" })).not.toBe(
      getPlanAdviceRevision({ plan: searchedPlan("plan-a"), today: "2026-11-15" }),
    );
  });
});
