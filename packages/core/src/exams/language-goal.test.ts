import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { onboardingDraftFixture } from "@zoonk/testing/fixtures/onboarding-drafts";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockGuestSession, mockSession } from "../_test-utils/mock-session";
import { insertGoalWithPlan } from "../goals/_utils/create-goal-records";
import { answerOnboardingQuestion } from "../view-models/onboarding/answer-onboarding-question";
import { moveLanguageGoalToExam } from "./move-language-goal";
import type * as GoalRecords from "../goals/_utils/create-goal-records";

// A write that fails partway (a dropped connection) can't be made with the real database: a test
// makes the exam goal's insert fail once, after the language goal was archived.
vi.mock("../goals/_utils/create-goal-records", async (importOriginal) => {
  const actual = await importOriginal<typeof GoalRecords>();
  return { ...actual, insertGoalWithPlan: vi.fn(actual.insertGoalWithPlan) };
});

const IELTS_REASON = { question: "reason", reason: "vou fazer o IELTS em março" } as const;

/** A learner's English goal typed in onboarding, so it carries the draft's id like every such goal. */
async function languageGoalInOnboarding() {
  const user = await userFixture();
  const draft = await onboardingDraftFixture({ userId: user.id });

  const goal = await goalFixture({
    dailyMinutes: 15,
    details: { onboardingId: draft.id },
    kind: "language",
    prompt: "Aprender inglês",
    targetLanguage: "en",
    userId: user.id,
  });

  mockSession(user.id);
  return { draft, goal, user };
}

describe(moveLanguageGoalToExam, () => {
  it("moves a language goal whose reason names a certificate to an exam goal", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { reason: "vou fazer o IELTS em março" },
      kind: "language",
      prompt: "Aprender inglês",
      targetLanguage: "en",
      userId: user.id,
    });

    mockSession(user.id);
    const result = await moveLanguageGoalToExam(goal.id);

    expect(result).toMatchObject({
      goal: {
        details: { examName: "IELTS", movedFromGoalId: goal.id },
        kind: "exam",
        title: "IELTS",
      },
      status: "moved",
    });

    const [old, created] = await Promise.all([
      prisma.goal.findUniqueOrThrow({ where: { id: goal.id } }),
      prisma.goal.findUniqueOrThrow({
        where: { id: result.status === "moved" ? result.goal.id : "" },
      }),
    ]);

    expect(old.status).toBe("archived");
    expect(created).toMatchObject({ kind: "exam", targetLanguage: "en" });
  });

  it("leaves goals without an exam alone", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { reason: "to travel" },
      kind: "language",
      targetLanguage: "en",
      userId: user.id,
    });

    mockSession(user.id);

    await expect(moveLanguageGoalToExam(goal.id)).resolves.toStrictEqual({ status: "noExam" });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      status: "active",
    });
  });

  it("moves a guest's only goal too: the exam goal replaces it, it isn't another goal", async () => {
    const guest = await userFixture();

    const goal = await goalFixture({
      details: { reason: "vou fazer o IELTS em março" },
      kind: "language",
      targetLanguage: "en",
      userId: guest.id,
    });

    await Promise.all([
      prisma.user.update({ data: { isAnonymous: true }, where: { id: guest.id } }),
      usageRecordsFixture({ count: 1, kind: "goal", userId: guest.id }),
    ]);

    mockGuestSession(guest.id);

    await expect(moveLanguageGoalToExam(goal.id)).resolves.toMatchObject({
      goal: { kind: "exam", title: "IELTS" },
      status: "moved",
    });

    await expect(
      prisma.goal.count({ where: { status: "active", userId: guest.id } }),
    ).resolves.toBe(1);

    await expect(moveLanguageGoalToExam(goal.id)).resolves.toMatchObject({
      goal: { kind: "exam", title: "IELTS" },
      status: "alreadyMoved",
    });

    await expect(prisma.goal.count({ where: { userId: guest.id } })).resolves.toBe(2);
  });
});

describe("onboarding's reason answer", () => {
  it("moves a language goal whose reason names a certificate, and onboarding goes on as the exam goal", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      kind: "language",
      prompt: "Aprender inglês",
      targetLanguage: "en",
      userId: user.id,
    });

    mockSession(user.id);

    const result = await answerOnboardingQuestion({
      goalId: goal.id,
      input: { question: "reason", reason: "vou fazer o IELTS em março" },
    });

    expect(result).toMatchObject({
      movedTo: {
        created: true,
        goal: { details: { movedFromGoalId: goal.id }, kind: "exam", title: "IELTS" },
      },
      status: "saved",
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      status: "archived",
    });
  });

  it("keeps a language goal whose reason names no exam", async () => {
    const user = await userFixture();

    const goal = await goalFixture({ kind: "language", targetLanguage: "en", userId: user.id });

    mockSession(user.id);

    await expect(
      answerOnboardingQuestion({
        goalId: goal.id,
        input: { question: "reason", reason: "to travel" },
      }),
    ).resolves.toStrictEqual({ movedTo: null, status: "saved" });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toMatchObject({
      status: "active",
    });
  });

  it("gives a reason sent again after its goal moved the same exam goal, without writing to the old one", async () => {
    const { goal } = await languageGoalInOnboarding();
    const first = await answerOnboardingQuestion({ goalId: goal.id, input: IELTS_REASON });
    const archived = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
    const again = await answerOnboardingQuestion({ goalId: goal.id, input: IELTS_REASON });

    expect(first).toMatchObject({ movedTo: { created: true }, status: "saved" });

    expect(again).toStrictEqual({
      movedTo: { created: false, goal: first.status === "saved" && first.movedTo?.goal },
      status: "saved",
    });

    await expect(prisma.goal.findUniqueOrThrow({ where: { id: goal.id } })).resolves.toStrictEqual(
      archived,
    );
  });

  it("makes one exam goal when the same reason is sent twice at once", async () => {
    const { goal, user } = await languageGoalInOnboarding();

    const answers = await Promise.all([
      answerOnboardingQuestion({ goalId: goal.id, input: IELTS_REASON }),
      answerOnboardingQuestion({ goalId: goal.id, input: IELTS_REASON }),
    ]);

    const moved = answers.map((answer) => (answer.status === "saved" ? answer.movedTo : null));

    // One of them created it; the other got it without starting its work again.
    expect(moved.filter((entry) => entry?.created)).toHaveLength(1);
    expect(moved.filter((entry) => entry?.created === false)).toHaveLength(1);
    expect(moved[0]?.goal.id).toBe(moved[1]?.goal.id);

    await expect(prisma.goal.count({ where: { kind: "exam", userId: user.id } })).resolves.toBe(1);
  });

  it("leaves the language goal as it was when the exam goal can't be written", async () => {
    const { goal, user } = await languageGoalInOnboarding();
    vi.mocked(insertGoalWithPlan).mockRejectedValueOnce(new Error("Connection lost"));

    await expect(
      answerOnboardingQuestion({ goalId: goal.id, input: IELTS_REASON }),
    ).rejects.toThrow("Connection lost");

    await expect(prisma.goal.findMany({ where: { userId: user.id } })).resolves.toMatchObject([
      { id: goal.id, status: "active" },
    ]);

    // Sent again, the reason moves it.
    await expect(
      answerOnboardingQuestion({ goalId: goal.id, input: IELTS_REASON }),
    ).resolves.toMatchObject({ movedTo: { created: true, goal: { title: "IELTS" } } });
  });
});
