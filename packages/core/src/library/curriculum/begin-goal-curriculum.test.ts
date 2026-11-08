import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { observeDatabaseQueries } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { listOwed } from "../../_test-utils/follow-ups";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { mockSession } from "../../_test-utils/mock-session";
import { answerOnboardingQuestion } from "../../view-models/onboarding/answer-onboarding-question";
import { beginGoalCurriculum } from "./begin-goal-curriculum";

describe(beginGoalCurriculum, () => {
  it("coalesces changed answers into one owed rebuild and leaves a repeated answer alone", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const goal = await goalFixture({
      details: { level: "basic", onboardingId: crypto.randomUUID(), purpose: "overview" },
      generationRunId: "writing-first-lesson",
      planRevealedAt: null,
      userId: user.id,
    });

    const { overlaps } = await observeDatabaseQueries(() =>
      beginGoalCurriculum({ goalId: goal.id, scope: { ownerId: null } }),
    );

    expect(overlaps).toStrictEqual([]);

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { purpose: "work", question: "purpose" },
    });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { purpose: "deep", question: "purpose" },
    });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { purpose: "deep", question: "purpose" },
    });

    await expect(listOwed(user.id)).resolves.toStrictEqual([
      { input: { goalId: goal.id }, key: goal.id, kind: "rebuildGoalCurriculum" },
    ]);

    await expect(
      prisma.followUp.findFirstOrThrow({ where: { userId: user.id } }),
    ).resolves.toMatchObject({ revision: 1 });
  });

  it.each([false, true])(
    "uses the gate's scope for an edited role (private: %s)",
    async (privateScope) => {
      const user = await userFixture();
      mockSession(user.id);

      const goal = await goalFixture({
        details: {
          level: "basic",
          onboardingId: crypto.randomUUID(),
          purpose: "work",
          role: "Analyst",
        },
        planRevealedAt: null,
        userId: user.id,
      });

      await beginGoalCurriculum({
        goalId: goal.id,
        scope: { ownerId: privateScope ? user.id : null },
      });

      await answerOnboardingQuestion({
        goalId: goal.id,
        input: { question: "role", role: "Engineer" },
      });

      await expect(listOwed(user.id)).resolves.toHaveLength(privateScope ? 1 : 0);
    },
  );

  it.each(["exam", "language"] as const)(
    "owes no graph for a shared %s level edit",
    async (kind) => {
      const user = await userFixture();
      mockSession(user.id);

      const goal = await goalFixture({
        details: {
          level: "basic",
          onboardingId: crypto.randomUUID(),
          reason: "travel",
          targetScore: "A2",
        },
        kind,
        planRevealedAt: null,
        targetLanguage: kind === "language" ? "en" : null,
        userId: user.id,
      });

      await beginGoalCurriculum({ goalId: goal.id, scope: { ownerId: null } });

      await answerOnboardingQuestion({
        goalId: goal.id,
        input: { level: "intermediate", question: "level" },
      });

      await expect(listOwed(user.id)).resolves.toStrictEqual([]);
    },
  );

  it("does not owe another graph while its gate still waits for the first answers", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const goal = await goalFixture({
      details: { answered: [], onboardingId: crypto.randomUUID(), purpose: "overview" },
      planRevealedAt: null,
      userId: user.id,
    });

    await beginGoalCurriculum({ goalId: goal.id, scope: { ownerId: null } });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { purpose: "work", question: "purpose" },
    });

    await expect(listOwed(user.id)).resolves.toStrictEqual([]);
  });

  it("owes a material exam's graph again when its date changes the lesson budget", async () => {
    const user = await userFixture();
    mockSession(user.id);
    const year = new Date().getUTCFullYear() + 1;

    const goal = await goalFixture({
      details: { materialIntent: "exam", onboardingId: crypto.randomUUID() },
      kind: "exam",
      planRevealedAt: null,
      targetDate: new Date(`${year}-10-01T00:00:00Z`),
      userId: user.id,
    });

    const source = await sourceFixture({
      extractedText: "Biology notes",
      kind: "upload",
      visibility: "private",
    });

    await learnerSourceFixture({ goalId: goal.id, sourceId: source.id, userId: user.id });
    await beginGoalCurriculum({ goalId: goal.id, scope: { ownerId: null } });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { question: "targetDate", targetDate: `${year}-11-01` },
    });

    await expect(listOwed(user.id)).resolves.toContainEqual({
      input: { goalId: goal.id },
      key: goal.id,
      kind: "rebuildGoalCurriculum",
    });
  });

  it("reads an edit before opening the gate, then owes one for an edit after it", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const goal = await goalFixture({
      details: { level: "basic", onboardingId: crypto.randomUUID(), purpose: "overview" },
      planRevealedAt: null,
      userId: user.id,
    });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { purpose: "deep", question: "purpose" },
    });

    const begun = await beginGoalCurriculum({ goalId: goal.id, scope: { ownerId: null } });
    expect(begun?.graphPrompt.purpose).toBe("deep");
    await expect(listOwed(user.id)).resolves.toStrictEqual([]);

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { purpose: "overview", question: "purpose" },
    });

    await expect(listOwed(user.id)).resolves.toHaveLength(1);
  });

  it("either reads a simultaneous edit or owes it, with no gap between the gate and answer save", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const goal = await goalFixture({
      details: { level: "basic", onboardingId: crypto.randomUUID(), purpose: "overview" },
      planRevealedAt: null,
      userId: user.id,
    });

    const held = holdLearnerLock({ userId: user.id });
    const pid = await held.pid;
    const starting = beginGoalCurriculum({ goalId: goal.id, scope: { ownerId: null } });

    const answering = answerOnboardingQuestion({
      goalId: goal.id,
      input: { purpose: "deep", question: "purpose" },
    });

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      held.release();
    }

    const [begun] = await Promise.all([starting, answering, held.done]);

    const owed = await listOwed(user.id);

    expect(
      begun?.graphPrompt.purpose === "deep" ||
        owed.some(({ kind }) => kind === "rebuildGoalCurriculum"),
    ).toBe(true);
  });

  it("does not rebuild after the reveal or when saving only the answered marker", async () => {
    const user = await userFixture();
    mockSession(user.id);

    const goal = await goalFixture({
      details: {
        answered: [],
        level: "basic",
        onboardingId: crypto.randomUUID(),
        purpose: "overview",
      },
      planRevealedAt: null,
      userId: user.id,
    });

    await beginGoalCurriculum({ goalId: goal.id, scope: { ownerId: null } });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { purpose: "overview", question: "purpose" },
    });

    await prisma.goal.update({ data: { planRevealedAt: new Date() }, where: { id: goal.id } });

    await answerOnboardingQuestion({
      goalId: goal.id,
      input: { purpose: "work", question: "purpose" },
    });

    await expect(listOwed(user.id)).resolves.toStrictEqual([]);
  });
});
