import { randomUUID } from "node:crypto";
import { classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { findExamDate } from "@zoonk/ai/tasks/goals/find-exam-date";
import { understandGoal } from "@zoonk/ai/tasks/goals/understand-goal";
import { decideExamIdentity } from "@zoonk/ai/tasks/research/exam-identity-decision";
import { prisma } from "@zoonk/db";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { start } from "workflow/api";
import { taskResult } from "../_test-utils/recorded-outputs";
import { goalUnderstandingWorkflow } from "./goal-understanding-workflow";

vi.mock("@zoonk/ai/tasks/goals/understand-goal", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  understandGoal: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/courses/intent", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  classifyCourseIntent: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/goals/find-exam-date", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  findExamDate: vi.fn(),
}));

vi.mock("@zoonk/ai/tasks/research/exam-identity-decision", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  decideExamIdentity: vi.fn(),
}));

describe(goalUnderstandingWorkflow, () => {
  it("retries each model call on its own, and completes the card without dates once the date search gives up", async () => {
    vi.mocked(decideExamIdentity).mockResolvedValue(null);
    vi.mocked(classifyCourseIntent).mockResolvedValue(taskResult({ intent: "learn" as const }));
    vi.mocked(findExamDate).mockRejectedValue(new Error("The search is down"));

    vi.mocked(understandGoal)
      .mockRejectedValueOnce(new Error("The model is down"))
      .mockResolvedValue(
        taskResult({
          followUps: [],
          goals: [
            {
              examDay: "official",
              examName: `Unstored Exam ${randomUUID()}`,
              kind: "exam",
              subject: "Law",
              title: "Pass the bar",
            },
          ],
          route: "goals",
        }),
      );

    const user = await userFixture();

    const draft = await onboardingDraftFixture({
      prompt: `pass the bar ${randomUUID()}`,
      status: "understanding",
      userId: user.id,
    });

    const run = await start(goalUnderstandingWorkflow, [{ draftId: draft.id }]);

    await expect(run.returnValue).resolves.toMatchObject({ status: "understood" });
    expect(understandGoal).toHaveBeenCalledTimes(2);
    expect(classifyCourseIntent).toHaveBeenCalledOnce();
    expect(findExamDate).toHaveBeenCalledTimes(4);

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({
      status: "understood",
      understanding: { goals: [{ draft: { title: "Pass the bar" }, examDates: [] }] },
    });
  });
});
