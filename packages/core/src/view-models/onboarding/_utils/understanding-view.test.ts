import { randomUUID } from "node:crypto";
import { type GoalUnderstanding, type UnderstoodGoal } from "@zoonk/ai/tasks/goals/understand-goal";
import { describe, expect, it } from "vitest";
import { type FoundExam, listExamLookups } from "./exam-facts";
import { toUnderstandingView } from "./understanding-view";

const TODAY = "2026-10-30";

const NOTICE_DAY = {
  date: "2099-11-08",
  estimated: false,
  label: "Day 1",
  registrationClosed: false,
  source: { title: "Official notice", url: "https://example.com/notice.pdf" },
};

async function cardOf({
  found = () => null,
  goal,
}: {
  found?: (lookup: FoundExam["lookup"]) => FoundExam | null;
  goal: UnderstoodGoal;
}) {
  const understanding: GoalUnderstanding = { followUps: [], goals: [goal], route: "goals" };
  const context = { goal: "a high score on the test", language: "en", onboardingId: randomUUID() };

  const exams = listExamLookups({
    language: "en",
    today: TODAY,
    understanding,
    words: context.goal,
  }).map((lookup) => (lookup ? found(lookup) : null));

  const view = await toUnderstandingView({
    context: { ...context, today: TODAY },
    exams,
    understanding,
  });

  return view.status === "goals" ? view.goals[0] : null;
}

describe(toUnderstandingView, () => {
  it("says on the draft that each candidate books the test", async () => {
    const card = await cardOf({
      goal: {
        examDay: "booked",
        examName: `Booked Test ${randomUUID()}`,
        examTarget: "score",
        kind: "exam",
        subject: "the test",
        title: "Prepare for the test",
      },
    });

    expect(card?.draft.details).toMatchObject({ examDay: "booked", examTarget: "score" });
  });

  it("gives an exam the notice's days with their source, and remembers the day it offers next to a month the learner named", async () => {
    const blueprintId = randomUUID();

    const cardFor = (examMonth: number) =>
      cardOf({
        found: (lookup) => ({ lookup, searched: [], stored: { blueprintId, dates: [NOTICE_DAY] } }),
        goal: {
          examMonth,
          examName: "Test Exam",
          examYear: 2099,
          kind: "exam",
          subject: "Test Exam",
          title: "Pass it",
        },
      });

    const [december, november] = await Promise.all([cardFor(12), cardFor(11)]);

    expect(december?.draft.examBlueprintId).toBe(blueprintId);
    expect(december?.examDates).toStrictEqual([NOTICE_DAY]);
    expect(december?.draft.details?.offeredNoticeDay).toBe("2099-11-08");
    expect(november?.draft.details?.offeredNoticeDay).toBeUndefined();
  });

  it("keeps the position the reading recorded beside it, so an exam choice can tell it from a typed one", async () => {
    const card = await cardOf({
      goal: {
        examDay: "official",
        examName: `Civil Service Exam ${randomUUID()}`,
        examTarget: "position",
        kind: "exam",
        subject: "the exam",
        targetPosition: "Court analyst, information technology",
        title: "Pass the civil service exam",
      },
    });

    expect(card?.draft.details).toMatchObject({
      positionFromReading: "Court analyst, information technology",
      targetPosition: "Court analyst, information technology",
    });
  });
});
