import { randomUUID } from "node:crypto";
import { findExamDate } from "@zoonk/ai/tasks/goals/find-exam-date";
import { type UnderstoodGoal } from "@zoonk/ai/tasks/goals/understand-goal";
import { decideExamIdentity } from "@zoonk/ai/tasks/research/exam-identity-decision";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toUnderstandingView } from "./understanding-view";

const TODAY = "2026-10-30";

async function viewOf(goal: UnderstoodGoal) {
  const user = await userFixture();

  return toUnderstandingView({
    context: {
      goal: "a high score on the test",
      language: "en",
      onboardingId: randomUUID(),
      today: TODAY,
      userId: user.id,
    },
    understanding: { followUps: [], goals: [goal], route: "goals" },
  });
}

describe(toUnderstandingView, () => {
  beforeEach(() => {
    vi.mocked(decideExamIdentity).mockResolvedValue(null);

    vi.mocked(findExamDate).mockResolvedValue({
      data: { dates: [], source: null, status: "unknown" },
      provenance: {} as never,
      systemPrompt: "",
      usage: {} as never,
      userPrompt: "",
    });
  });

  it("never searches for the official day of a test each candidate books, and says so in the draft", async () => {
    const view = await viewOf({
      examDay: "booked",
      examName: `Booked Test ${randomUUID()}`,
      examTarget: "score",
      kind: "exam",
      subject: "the test",
      title: "Prepare for the test",
    });

    expect(view.status === "goals" ? view.goals[0]?.draft.details : null).toMatchObject({
      examDay: "booked",
      examTarget: "score",
    });

    expect(findExamDate).not.toHaveBeenCalled();
  });

  it("searches for the official day of an exam its organizer sets", async () => {
    await viewOf({
      examDay: "official",
      examName: `Entrance Exam ${randomUUID()}`,
      kind: "exam",
      subject: "the exam",
      title: "Pass the entrance exam",
    });

    expect(findExamDate).toHaveBeenCalledOnce();
  });
});
