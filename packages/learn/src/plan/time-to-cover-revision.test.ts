import { describe, expect, it } from "vitest";
import { getTimeToCoverRevision } from "./time-to-cover-revision";

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
      fullCourse: false,
      lightWeeks: [],
      mocks: null,
      nextSitting: null,
      noSitting: null,
      noticeDay: null,
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

describe(getTimeToCoverRevision, () => {
  it("keys an answer to the plan it was found for, never to another goal's plan that looks the same", () => {
    expect(getTimeToCoverRevision(searchedPlan("plan-a"))).not.toBe(
      getTimeToCoverRevision(searchedPlan("plan-b")),
    );
  });

  it("keeps the answer when the same plan comes back unchanged", () => {
    expect(getTimeToCoverRevision(searchedPlan("plan-a"))).toBe(
      getTimeToCoverRevision(searchedPlan("plan-a")),
    );
  });
});
