import { randomUUID } from "node:crypto";
import { classifyCourseIntent } from "@zoonk/ai/tasks/courses/intent";
import { findExamDate } from "@zoonk/ai/tasks/goals/find-exam-date";
import { understandGoal } from "@zoonk/ai/tasks/goals/understand-goal";
import { decideExamIdentity } from "@zoonk/ai/tasks/research/exam-identity-decision";
import { prisma } from "@zoonk/db";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { examBlueprintFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it("decides each stored candidate in a step of its own, retrying only the decision that failed", async () => {
    const town = randomUUID().slice(0, 8);
    const source = await sourceFixture({ title: "Official notice" });

    const storedBarExam = (date: string) =>
      examBlueprintFixture({
        edition: {
          check: null,
          citations: [],
          dates: [
            {
              citation: { passage: "The exam takes place on", sourceId: source.id },
              date,
              kind: "exam",
              label: "Exam day",
              startTime: null,
            },
          ],
          noticeUrl: null,
          questionCount: null,
          sourceHash: null,
          timeZone: null,
          year: 2027,
        },
        name: `County Bar Exam ${town}`,
      });

    const [failing, sibling] = await Promise.all([
      storedBarExam("2027-03-14"),
      storedBarExam("2027-09-12"),
    ]);

    vi.mocked(classifyCourseIntent).mockResolvedValue(taskResult({ intent: "learn" as const }));

    vi.mocked(understandGoal).mockResolvedValue(
      taskResult({
        followUps: [],
        goals: [
          {
            examDay: "official",
            examName: `The ${town} County Bar Exam`,
            examYear: 2027,
            kind: "exam",
            subject: "Law",
            title: "Pass the bar",
          },
        ],
        route: "goals",
      }),
    );

    let failed = false;

    vi.mocked(decideExamIdentity).mockImplementation(async ({ candidates: [candidate] }) => {
      if (candidate?.id === failing.id && !failed) {
        failed = true;
        throw new Error("The model is down");
      }

      const probabilities = { [failing.id]: 0.9, [sibling.id]: 0.7 };
      const probability = candidate && probabilities[candidate.id];

      return candidate && probability ? { id: candidate.id, probability } : null;
    });

    const user = await userFixture();

    const draft = await onboardingDraftFixture({
      prompt: `pass the ${town} bar ${randomUUID()}`,
      status: "understanding",
      userId: user.id,
    });

    const run = await start(goalUnderstandingWorkflow, [{ draftId: draft.id }]);
    await expect(run.returnValue).resolves.toMatchObject({ status: "understood" });

    const { calls } = vi.mocked(decideExamIdentity).mock;

    const decided = calls.flatMap(([{ candidates }]) =>
      candidates.map((candidate) => candidate.id),
    );

    expect(calls.every(([{ candidates }]) => candidates.length === 1)).toBe(true);
    expect(decided.filter((id) => id === failing.id)).toHaveLength(2);
    expect(decided.filter((id) => id === sibling.id)).toHaveLength(1);
    expect(findExamDate).not.toHaveBeenCalled();

    await expect(
      prisma.onboardingDraft.findUniqueOrThrow({ where: { id: draft.id } }),
    ).resolves.toMatchObject({
      status: "understood",
      understanding: { goals: [{ examDates: [{ date: "2027-03-14", estimated: false }] }] },
    });
  });
});
