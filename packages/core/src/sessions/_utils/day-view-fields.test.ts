import { describe, expect, it } from "vitest";
import { type DayViewFieldsInput, toDayViewFields } from "./day-view-fields";

const TODAY = new Date("2026-10-17T00:00:00Z");

/**
 * Ana's exam day back after a week: a review to do, time left in the day, and its lessons still
 * being outlined, past her free week of exam prep or within it.
 */
function examDay({ trialEnded }: { trialEnded: boolean }): DayViewFieldsInput {
  return {
    answers: [],
    current: true,
    dailyLimit: null,
    dayMinutes: 40,
    examAccess: { includesMockExams: !trialEnded, trialEnded },
    lessonsComing: true,
    missions: [],
    session: {
      blocks: [
        {
          brainPower: 0,
          canDo: null,
          estimatedMinutes: 8,
          kind: "review",
          lessonId: null,
          payload: {},
          position: 0,
          status: "pending",
        },
      ],
      freshStart: "welcomeBack",
      fullMealAt: null,
      goal: null,
      goalId: "goal",
      localDate: TODAY,
      plannedMinutes: 8,
    },
    sessionBar: { completed: 0, total: 1 },
    week: { days: [], nextStudyDate: null, time: { studiedMinutes: 0, targetMinutes: 0 } },
  };
}

/** The same day with no blocks, its lessons still being outlined. */
function emptyExamDay({ trialEnded }: { trialEnded: boolean }): DayViewFieldsInput {
  const day = examDay({ trialEnded });
  return { ...day, emptyDay: "lessonsComing", session: { ...day.session, blocks: [] } };
}

describe(toDayViewFields, () => {
  // Ana's Today past her free week said "2 activities so far · more as you go", and nothing came:
  // the free plan adds no new lessons.
  it("promises no lessons to come on a free exam plan past its first week", () => {
    expect(toDayViewFields(examDay({ trialEnded: true })).lessonsComing).toBe(false);
    expect(toDayViewFields(examDay({ trialEnded: false })).lessonsComing).toBe(true);
  });

  // With nothing to review, the free day would say "Getting today's lessons ready…" and wait.
  it("says an empty day on a free exam plan past its first week has nothing new, never lessons on the way", () => {
    expect(toDayViewFields(emptyExamDay({ trialEnded: true })).emptyDay).toBe("nothingNew");
    expect(toDayViewFields(emptyExamDay({ trialEnded: false })).emptyDay).toBe("lessonsComing");
  });
});
