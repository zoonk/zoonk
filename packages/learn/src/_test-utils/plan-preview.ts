import { type PlanView } from "@zoonk/core/plans/view-contract";

export function previewPlan() {
  return {
    areas: [],
    bases: null,
    examChoices: [],
    feasibility: null,
    planId: "plan",
    schedule: {
      dailyMinutes: 30,
      dailyTimes: [],
      fullCourse: false,
      lightWeeks: [],
      mocks: null,
      nextSitting: null,
      noSitting: null,
      noticeDay: null,
      shape: {
        canDiffer: false,
        weekdayDays: [1, 2, 3],
        weekdays: 30,
        weekend: null,
        weekendDays: [],
      },
      studyDays: 3,
      targetDate: "2027-03-01",
      targetDateEstimated: false,
      targetDateNamedMonth: false,
      weekdayMinutes: [0, 30, 30, 30, 0, 0, 0],
    },
    steering: {
      difficultyBias: "standard",
      lessonsStudied: 0,
      practiceBias: "balanced",
      skippedActivities: [],
    },
    week: { days: [], endDate: "2026-11-22", startDate: "2026-11-16" },
  } satisfies Pick<
    PlanView,
    "areas" | "bases" | "examChoices" | "feasibility" | "planId" | "schedule" | "steering" | "week"
  >;
}
