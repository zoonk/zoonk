import { describe, expect, it } from "vitest";
import { type DayViewFieldsInput, toDayViewFields } from "./day-view-fields";

const TODAY = new Date("2026-10-17T00:00:00Z");

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

function emptyExamDay({ trialEnded }: { trialEnded: boolean }): DayViewFieldsInput {
  const day = examDay({ trialEnded });
  return { ...day, emptyDay: "lessonsComing", session: { ...day.session, blocks: [] } };
}

describe(toDayViewFields, () => {
  it("promises no lessons to come on a free exam plan past its first week", () => {
    expect(toDayViewFields(examDay({ trialEnded: true })).lessonsComing).toBe(false);
    expect(toDayViewFields(examDay({ trialEnded: false })).lessonsComing).toBe(true);
  });

  it("says an empty day on a free exam plan past its first week has nothing new, never lessons on the way", () => {
    expect(toDayViewFields(emptyExamDay({ trialEnded: true })).emptyDay).toBe("nothingNew");
    expect(toDayViewFields(emptyExamDay({ trialEnded: false })).emptyDay).toBe("lessonsComing");
  });
});
